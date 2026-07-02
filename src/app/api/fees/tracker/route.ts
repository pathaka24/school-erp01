import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireScope } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

// GET /api/fees/tracker?classId=&sectionId=&session=YYYY-YYYY
// Month-by-month fee register for a class: each student's fee status across the
// 12 academic-year months (Apr→Mar), plus per-month and grand totals.
export async function GET(request: NextRequest) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const sp = request.nextUrl.searchParams;
  const classId = sp.get('classId');
  const sectionId = sp.get('sectionId');
  const session = sp.get('session');
  if (!classId) return Response.json({ error: 'classId is required' }, { status: 400 });

  const now = new Date();
  const defStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  let start = defStart;
  if (session && /^\d{4}-\d{4}$/.test(session)) start = parseInt(session.split('-')[0], 10);

  const months: string[] = [];
  for (let m = 4; m <= 12; m++) months.push(`${start}-${String(m).padStart(2, '0')}`);
  for (let m = 1; m <= 3; m++) months.push(`${start + 1}-${String(m).padStart(2, '0')}`);

  const students = await prisma.student.findMany({
    where: { classId, ...(sectionId ? { sectionId } : {}), user: { isActive: true } },
    select: {
      id: true, admissionNo: true, rollNumber: true,
      user: { select: { firstName: true, lastName: true } },
      section: { select: { name: true } },
    },
    orderBy: [{ rollNumber: 'asc' }, { user: { firstName: 'asc' } }],
  });
  const ids = students.map(s => s.id);

  const charges = ids.length === 0 ? [] : await prisma.feeLedger.findMany({
    where: { studentId: { in: ids }, month: { in: months }, type: 'CHARGE', voidedAt: null, archivedAt: null },
    select: { studentId: true, month: true, amount: true, paidAmount: true },
  });
  const map = new Map<string, Map<string, { total: number; paid: number }>>();
  for (const c of charges) {
    let mm = map.get(c.studentId);
    if (!mm) { mm = new Map(); map.set(c.studentId, mm); }
    const e = mm.get(c.month) || { total: 0, paid: 0 };
    e.total += c.amount; e.paid += c.paidAmount;
    mm.set(c.month, e);
  }

  const monthTotals: Record<string, { billed: number; collected: number; due: number }> = {};
  for (const m of months) monthTotals[m] = { billed: 0, collected: 0, due: 0 };

  const rows = students.map(s => {
    const mm = map.get(s.id);
    const cells: Record<string, any> = {};
    let totalFee = 0, totalPaid = 0;
    for (const m of months) {
      const e = mm?.get(m);
      if (!e || e.total <= 0) { cells[m] = { total: 0, paid: 0, due: 0, status: 'NONE' }; continue; }
      const paid = Math.min(e.paid, e.total);
      const due = Math.max(0, e.total - paid);
      const status = due <= 0.5 ? 'PAID' : (paid > 0.5 ? 'PARTIAL' : 'UNPAID');
      cells[m] = { total: e.total, paid, due, status };
      totalFee += e.total; totalPaid += paid;
      monthTotals[m].billed += e.total; monthTotals[m].collected += paid; monthTotals[m].due += due;
    }
    return {
      id: s.id, name: `${s.user.firstName} ${s.user.lastName}`.trim(),
      admissionNo: s.admissionNo, roll: s.rollNumber, section: s.section?.name || '',
      cells, totalFee, totalPaid, totalDue: totalFee - totalPaid,
    };
  });

  const grand = {
    billed: rows.reduce((a, r) => a + r.totalFee, 0),
    collected: rows.reduce((a, r) => a + r.totalPaid, 0),
    due: rows.reduce((a, r) => a + r.totalDue, 0),
  };

  return Response.json({ session: `${start}-${start + 1}`, months, students: rows, monthTotals, grand });
}
