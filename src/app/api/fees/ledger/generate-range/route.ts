import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { recomputeStudentLedger } from '@/lib/feeLedger';
import { requireScope } from '@/lib/apiAuth';

// POST /api/fees/ledger/generate-range
// Body: { session?: 'YYYY-YYYY', classId?, sectionId? }
// Fills every MISSING monthly fee from April → the current month for the given
// session and scope, using each student's own fee (or class default). One
// recompute per affected student. Never bills future months.
export async function POST(request: NextRequest) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const { session, classId, sectionId } = body;

  const now = new Date();
  const defStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  let start = defStart;
  if (session && /^\d{4}-\d{4}$/.test(session)) start = parseInt(session.split('-')[0], 10);
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const allMonths: string[] = [];
  for (let m = 4; m <= 12; m++) allMonths.push(`${start}-${String(m).padStart(2, '0')}`);
  for (let m = 1; m <= 3; m++) allMonths.push(`${start + 1}-${String(m).padStart(2, '0')}`);
  const months = allMonths.filter(m => m <= curMonth); // only up to current month
  if (months.length === 0) return Response.json({ created: 0, months: 0, note: 'Session has no past/current months yet' });

  // Class defaults from the fee plan
  const setting = await prisma.schoolSettings.findUnique({ where: { key: 'feePlan' } });
  const byClass = new Map<string, number>();
  if (setting) {
    try { const plan = JSON.parse(setting.value); for (const c of plan?.classes || []) { const a = Number(c.monthlyFee) || 0; if (a > 0) byClass.set(c.classId, a); } } catch {}
  }

  const studentWhere: any = { user: { isActive: true }, feeExempt: false };
  if (classId) studentWhere.classId = classId;
  if (sectionId) studentWhere.sectionId = sectionId;
  const students = await prisma.student.findMany({ where: studentWhere, select: { id: true, classId: true, monthlyFee: true } });
  if (students.length === 0) return Response.json({ error: 'No students in scope' }, { status: 404 });
  const ids = students.map(s => s.id);

  // Existing monthly fees (voided or not) so deliberate voids aren't resurrected
  const existing = await prisma.feeLedger.findMany({
    where: { studentId: { in: ids }, month: { in: months }, type: 'CHARGE', category: 'MONTHLY_FEE' },
    select: { studentId: true, month: true },
  });
  const have = new Set(existing.map(e => `${e.studentId}|${e.month}`));

  const toCreate: any[] = [];
  const affected = new Set<string>();
  for (const s of students) {
    const amount = s.monthlyFee != null && s.monthlyFee > 0 ? s.monthlyFee : byClass.get(s.classId);
    if (!amount) continue;
    for (const m of months) {
      if (have.has(`${s.id}|${m}`)) continue;
      const label = new Date(m + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      toCreate.push({
        id: `mf_${s.id}_${m}`, studentId: s.id, month: m,
        type: 'CHARGE', category: 'MONTHLY_FEE', description: `Monthly Fee - ${label}`,
        amount, balanceAfter: 0, date: new Date(m + '-01T00:00:00Z'),
      });
      affected.add(s.id);
    }
  }

  if (toCreate.length > 0) {
    await prisma.feeLedger.createMany({ data: toCreate, skipDuplicates: true });
    for (const sid of affected) await recomputeStudentLedger(sid);
  }

  return Response.json({
    created: toCreate.length,
    months: months.length,
    studentsAffected: affected.size,
    totalAmount: toCreate.reduce((a, t) => a + t.amount, 0),
  }, { status: 201 });
}
