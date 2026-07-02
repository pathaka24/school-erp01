import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireScope } from '@/lib/apiAuth';

// GET /api/fees/dues?classId=&minMonths=
//
// Late-payers / defaulters report. For every ACTIVE student with anything
// outstanding, returns how far behind they are — built from the FIFO
// paidAmount tracking, so partial payments are reflected accurately:
//   - balance:        current outstanding (latest balanceAfter)
//   - oldestDueMonth: first month with an unpaid/partially-paid charge
//   - monthsLate:     how many months ago that oldest due month was
//   - unpaidMonths:   count of distinct months that still have dues
//   - hasPartial:     true if some charge is part-paid (parent paying "some amount")
//   - lastPaymentDate/lastPaymentAmount: most recent deposit
export async function GET(request: NextRequest) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const sp = request.nextUrl.searchParams;
  const classId = sp.get('classId');
  const minMonths = parseInt(sp.get('minMonths') || '0', 10);

  const students = await prisma.student.findMany({
    where: { user: { isActive: true }, ...(classId ? { classId } : {}) },
    select: {
      id: true, admissionNo: true, rollNumber: true,
      fatherName: true, fatherPhone: true, motherPhone: true, guardianPhone: true,
      user: { select: { firstName: true, lastName: true, phone: true } },
      class: { select: { name: true, numericGrade: true } },
      section: { select: { name: true } },
    },
  });
  if (students.length === 0) return Response.json({ rows: [], totals: { totalOutstanding: 0, studentCount: 0 } });

  const ids = students.map(s => s.id);
  const [latest, charges, lastDeposits, reminders] = await Promise.all([
    prisma.feeLedger.findMany({
      where: { studentId: { in: ids }, voidedAt: null, archivedAt: null },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      distinct: ['studentId'],
      select: { studentId: true, balanceAfter: true },
    }),
    prisma.feeLedger.findMany({
      where: { studentId: { in: ids }, voidedAt: null, archivedAt: null, type: 'CHARGE' },
      select: { studentId: true, month: true, amount: true, paidAmount: true },
    }),
    prisma.feeLedger.findMany({
      where: { studentId: { in: ids }, voidedAt: null, archivedAt: null, type: 'DEPOSIT' },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      distinct: ['studentId'],
      select: { studentId: true, date: true, amount: true },
    }),
    prisma.feeReminder.groupBy({
      by: ['studentId'],
      where: { studentId: { in: ids } },
      _count: { id: true },
      _max: { sentAt: true },
    }),
  ]);

  const balanceMap = new Map(latest.map(e => [e.studentId, e.balanceAfter]));
  const depositMap = new Map(lastDeposits.map(e => [e.studentId, e]));
  const reminderMap = new Map(reminders.map(r => [r.studentId, { count: r._count.id, last: r._max.sentAt }]));
  const chargesByStudent = new Map<string, typeof charges>();
  for (const c of charges) {
    const list = chargesByStudent.get(c.studentId) || [];
    list.push(c);
    chargesByStudent.set(c.studentId, list);
  }

  const now = new Date();
  const nowKey = now.getFullYear() * 12 + now.getMonth(); // months since year 0
  const monthKey = (m: string) => {
    const [y, mm] = m.split('-').map(Number);
    return y * 12 + (mm - 1);
  };

  const rows = [];
  for (const s of students) {
    const balance = balanceMap.get(s.id) ?? 0;
    if (balance <= 0.005) continue;

    const due = (chargesByStudent.get(s.id) || []).filter(c => c.amount - c.paidAmount > 0.005);
    const dueMonths = Array.from(new Set(due.map(c => c.month))).sort();
    const oldestDueMonth = dueMonths[0] || null;
    const monthsLate = oldestDueMonth ? Math.max(0, nowKey - monthKey(oldestDueMonth)) : 0;
    if (monthsLate < minMonths) continue;
    const lastDep = depositMap.get(s.id);
    const rem = reminderMap.get(s.id);

    rows.push({
      studentId: s.id,
      name: `${s.user.firstName} ${s.user.lastName}`.trim(),
      admissionNo: s.admissionNo,
      rollNumber: s.rollNumber,
      className: s.class?.name,
      sectionName: s.section?.name,
      fatherName: s.fatherName,
      phone: s.fatherPhone || s.motherPhone || s.guardianPhone || s.user.phone || null,
      balance,
      oldestDueMonth,
      monthsLate,
      unpaidMonths: dueMonths.length,
      hasPartial: due.some(c => c.paidAmount > 0.005),
      lastPaymentDate: lastDep?.date || null,
      lastPaymentAmount: lastDep?.amount ?? null,
      lastReminderAt: rem?.last || null,
      reminderCount: rem?.count || 0,
    });
  }

  rows.sort((a, b) => b.monthsLate - a.monthsLate || b.balance - a.balance);

  // Aging buckets (oldest-first paidAmount is accurate) — over all in-scope charges
  const nowIdx = now.getFullYear() * 12 + now.getMonth();
  const aging = { current: 0, m1: 0, m23: 0, m4plus: 0 };
  for (const c of charges) {
    const dueAmt = c.amount - c.paidAmount;
    if (dueAmt <= 0.5) continue;
    const [yy, mm] = c.month.split('-').map(Number);
    const age = nowIdx - (yy * 12 + (mm - 1));
    if (age <= 0) aging.current += dueAmt;
    else if (age === 1) aging.m1 += dueAmt;
    else if (age <= 3) aging.m23 += dueAmt;
    else aging.m4plus += dueAmt;
  }

  // Dues by class
  const byClassMap = new Map<string, { name: string; outstanding: number; students: number }>();
  for (const s of students) {
    const bal = balanceMap.get(s.id) || 0;
    if (bal <= 0.5) continue;
    const cn = s.class?.name || '—';
    const e = byClassMap.get(cn) || { name: cn, outstanding: 0, students: 0 };
    e.outstanding += bal; e.students++;
    byClassMap.set(cn, e);
  }
  const byClass = Array.from(byClassMap.values()).sort((a, b) => b.outstanding - a.outstanding);

  return Response.json({
    rows,
    aging,
    byClass,
    totals: {
      totalOutstanding: rows.reduce((t, r) => t + r.balance, 0),
      studentCount: rows.length,
      threePlusMonths: rows.filter(r => r.monthsLate >= 3).length,
    },
  });
}
