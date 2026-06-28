import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { recomputeStudentLedger } from '@/lib/feeLedger';
import { requireScope } from '@/lib/apiAuth';

// POST /api/fees/ledger/multi-charge
// Body: {
//   studentIds: string[],                         // one student, or siblings (family view)
//   fromMonth: 'YYYY-MM', toMonth?: 'YYYY-MM',     // applied to each month in the range
//   charges: [{ category, description, amount }],  // one or more charge lines
//   entryDate?: string,
// }
// Creates each charge line for each month in [fromMonth..toMonth] for each
// student. MONTHLY_FEE is deduped (one per student+month, never duplicated —
// against existing entries AND within the batch). One balance recompute per
// affected student. Returns { created, skipped, ... }.
export async function POST(request: NextRequest) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const { studentIds, fromMonth, entryDate } = body;
  const toMonth = body.toMonth;

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return Response.json({ error: 'studentIds is required' }, { status: 400 });
  }
  if (!fromMonth || !/^\d{4}-\d{2}$/.test(fromMonth)) {
    return Response.json({ error: 'fromMonth (YYYY-MM) is required' }, { status: 400 });
  }
  const to = toMonth && /^\d{4}-\d{2}$/.test(toMonth) ? toMonth : fromMonth;
  if (to < fromMonth) return Response.json({ error: 'toMonth is before fromMonth' }, { status: 400 });

  // Each line has a frequency: MONTHLY (repeats for every month in the range) or
  // ONCE (a one-time charge — books, annual, registration… — created a single
  // time, in the From month). Defaults: MONTHLY_FEE → MONTHLY, everything else → ONCE.
  const lines = (body.charges || [])
    .map((c: any) => ({
      category: c.category || 'AD_HOC',
      description: String(c.description || '').trim(),
      amount: parseFloat(c.amount) || 0,
      frequency: c.frequency === 'MONTHLY' || (c.frequency == null && c.category === 'MONTHLY_FEE') ? 'MONTHLY' : 'ONCE',
      // Optional per-student amount (family view: each child a different amount)
      perStudent: c.perStudent && typeof c.perStudent === 'object' ? c.perStudent : null,
    }))
    .filter((c: any) => c.amount > 0 || (c.perStudent && Object.values(c.perStudent).some((v: any) => parseFloat(v) > 0)));
  if (lines.length === 0) return Response.json({ error: 'Add at least one charge with an amount' }, { status: 400 });

  const amountFor = (line: any, sid: string): number => {
    if (line.perStudent && line.perStudent[sid] != null && line.perStudent[sid] !== '') {
      const n = parseFloat(String(line.perStudent[sid]));
      return isNaN(n) ? 0 : n;
    }
    return line.amount;
  };

  // Expand the month range (inclusive), capped for safety
  const months: string[] = [];
  let [y, m] = fromMonth.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++; if (m > 12) { m = 1; y++; }
    if (months.length > 60) break;
  }

  const students = await prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true } });
  if (students.length !== studentIds.length) return Response.json({ error: 'One or more students not found' }, { status: 404 });

  // Existing monthly fees (per student+month) so we never duplicate them
  const hasMonthly = lines.some((l: any) => l.category === 'MONTHLY_FEE');
  const seenMonthly = new Set<string>();
  if (hasMonthly) {
    const ex = await prisma.feeLedger.findMany({
      where: { studentId: { in: studentIds }, month: { in: months }, type: 'CHARGE', category: 'MONTHLY_FEE', voidedAt: null },
      select: { studentId: true, month: true },
    });
    for (const e of ex) seenMonthly.add(`${e.studentId}|${e.month}`);
  }

  const toCreate: any[] = [];
  const affected = new Set<string>();
  let skipped = 0;
  for (const sid of studentIds as string[]) {
    for (const line of lines) {
      const amt = amountFor(line, sid);
      if (!(amt > 0)) continue; // this child has no amount for this line — skip
      // One-time charges only land in the first month; monthly charges repeat
      const lineMonths = line.frequency === 'MONTHLY' ? months : [months[0]];
      for (const month of lineMonths) {
        const d = entryDate ? new Date(entryDate) : new Date(month + '-01T00:00:00Z');
        const date = isNaN(d.getTime()) ? new Date() : d;
        if (line.category === 'MONTHLY_FEE') {
          const key = `${sid}|${month}`;
          if (seenMonthly.has(key)) { skipped++; continue; }
          seenMonthly.add(key); // prevent a duplicate within this batch too
          toCreate.push({
            id: `mf_${sid}_${month}`, // deterministic — idempotent with auto-accrual
            studentId: sid, month, date,
            type: 'CHARGE', category: 'MONTHLY_FEE',
            description: line.description || `Monthly Fee - ${new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`,
            amount: amt, balanceAfter: 0,
          });
        } else {
          toCreate.push({
            studentId: sid, month, date,
            type: 'CHARGE', category: line.category,
            description: line.description || line.category.replace(/_/g, ' '),
            amount: amt, balanceAfter: 0,
          });
        }
        affected.add(sid);
      }
    }
  }

  if (toCreate.length > 0) {
    await prisma.feeLedger.createMany({ data: toCreate, skipDuplicates: true });
    for (const sid of affected) await recomputeStudentLedger(sid);
  }

  return Response.json({
    created: toCreate.length,
    skipped,
    studentsAffected: affected.size,
    months: months.length,
    lines: lines.length,
    totalAmount: toCreate.reduce((s, c) => s + c.amount, 0),
  }, { status: 201 });
}
