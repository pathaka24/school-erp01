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
  const [latest, charges, lastDeposits] = await Promise.all([
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
  ]);

  const balanceMap = new Map(latest.map(e => [e.studentId, e.balanceAfter]));
  const depositMap = new Map(lastDeposits.map(e => [e.studentId, e]));
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
    });
  }

  rows.sort((a, b) => b.monthsLate - a.monthsLate || b.balance - a.balance);

  return Response.json({
    rows,
    totals: {
      totalOutstanding: rows.reduce((t, r) => t + r.balance, 0),
      studentCount: rows.length,
      threePlusMonths: rows.filter(r => r.monthsLate >= 3).length,
    },
  });
}
