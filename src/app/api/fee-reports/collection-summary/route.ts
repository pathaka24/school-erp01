import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/fee-reports/collection-summary?month=YYYY-MM (default: current month)
//
// Returns:
//   - Collected this month (sum of non-voided DEPOSITs in the given month)
//   - Charges raised this month
//   - Total outstanding (sum of positive balanceAfter across latest non-voided entry per student)
//   - Defaulter count (students with balance > 0)
//   - Top 10 defaulters with class/section/balance
//   - Collection breakdown by payment method (this month)
//   - Daily collection for the past 30 days (sparkline data)
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const now = new Date();
  const month = sp.get('month') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Collected this month
  const collected = await prisma.feeLedger.aggregate({
    where: { month, type: 'DEPOSIT', voidedAt: null, archivedAt: null },
    _sum: { amount: true },
    _count: { id: true },
  });

  // Charges raised this month
  const charged = await prisma.feeLedger.aggregate({
    where: { month, type: 'CHARGE', voidedAt: null, archivedAt: null },
    _sum: { amount: true },
    _count: { id: true },
  });

  // Outstanding totals + defaulters via raw query against latest balance per student
  const outstandingRows = await prisma.$queryRaw<{ studentId: string; balanceAfter: number }[]>`
    SELECT DISTINCT ON ("studentId") "studentId", "balanceAfter"
    FROM "fee_ledger"
    WHERE "voidedAt" IS NULL AND "archivedAt" IS NULL
    ORDER BY "studentId", "date" DESC, "createdAt" DESC, "id" DESC
  `;
  const owingRows = outstandingRows.filter(r => r.balanceAfter > 0);
  const totalOutstanding = owingRows.reduce((s, r) => s + r.balanceAfter, 0);

  // Break the outstanding down by the academic year of each unpaid charge.
  // For a student who owes, their unpaid charges (amount − paidAmount via FIFO)
  // sum to their balance, so this split adds back up to totalOutstanding.
  // AY = Apr(y)…Mar(y+1). currentAY = today's AY; earlier = previous years.
  const nowAY = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  const [allCharges, creditGroups] = await Promise.all([
    prisma.feeLedger.findMany({
      where: { type: 'CHARGE', voidedAt: null, archivedAt: null },
      select: { studentId: true, month: true, category: true, amount: true, date: true },
    }),
    prisma.feeLedger.groupBy({
      by: ['studentId'],
      where: { type: { in: ['DEPOSIT', 'DISCOUNT'] }, voidedAt: null, archivedAt: null },
      _sum: { amount: true },
    }),
  ]);
  const creditByStudent = new Map(creditGroups.map(g => [g.studentId, g._sum.amount || 0]));
  const chargesByStudent = new Map<string, typeof allCharges>();
  for (const c of allCharges) {
    if (!chargesByStudent.has(c.studentId)) chargesByStudent.set(c.studentId, []);
    chargesByStudent.get(c.studentId)!.push(c);
  }

  let currentYearDue = 0, previousYearsDue = 0, previousBalanceDue = 0;
  const byYearMap = new Map<number, { ay: number; amount: number; students: Set<string> }>();
  for (const [sid, chs] of chargesByStudent) {
    // Apply the student's TOTAL credits (deposits + discounts) to their charges
    // oldest-first, so the leftover unpaid sums exactly to their net balance.
    let credit = creditByStudent.get(sid) || 0;
    chs.sort((a, b) => a.month === b.month ? (a.date.getTime() - b.date.getTime()) : (a.month < b.month ? -1 : 1));
    for (const c of chs) {
      const pay = Math.min(credit, c.amount);
      credit -= pay;
      const unpaid = c.amount - pay;
      if (unpaid <= 0.5) continue;
      const [yy, mm] = c.month.split('-').map(Number);
      const chargeAY = mm >= 4 ? yy : yy - 1;
      if (chargeAY >= nowAY) currentYearDue += unpaid; else previousYearsDue += unpaid;
      if (c.category === 'PREVIOUS_BALANCE') previousBalanceDue += unpaid;
      if (!byYearMap.has(chargeAY)) byYearMap.set(chargeAY, { ay: chargeAY, amount: 0, students: new Set() });
      const yr = byYearMap.get(chargeAY)!;
      yr.amount += unpaid;
      yr.students.add(sid);
    }
  }
  const outstandingBreakdown = {
    total: totalOutstanding,
    studentsOwing: owingRows.length,
    currentYear: currentYearDue,
    previousYears: previousYearsDue,
    previousBalanceEntries: previousBalanceDue,
    currentAY: nowAY,
    byYear: Array.from(byYearMap.values())
      .map(y => ({ ay: y.ay, amount: y.amount, students: y.students.size }))
      .sort((a, b) => b.ay - a.ay),
  };

  // Top 10 defaulters with student info
  const sorted = [...owingRows].sort((a, b) => b.balanceAfter - a.balanceAfter).slice(0, 10);
  const top10Ids = sorted.map(r => r.studentId);
  const top10Students = top10Ids.length === 0 ? [] : await prisma.student.findMany({
    where: { id: { in: top10Ids } },
    include: {
      user: { select: { firstName: true, lastName: true, phone: true } },
      class: { select: { name: true } },
      section: { select: { name: true } },
    },
  });
  const top10Map = new Map(top10Students.map(s => [s.id, s]));
  const topDefaulters = sorted.map(r => {
    const s = top10Map.get(r.studentId);
    return {
      studentId: r.studentId,
      name: s ? `${s.user.firstName} ${s.user.lastName}`.trim() : '?',
      phone: s?.user.phone || null,
      class: s?.class?.name,
      section: s?.section?.name,
      admissionNo: s?.admissionNo,
      balance: r.balanceAfter,
    };
  });

  // Collection by payment method (this month)
  const methodGroups = await prisma.feeLedger.groupBy({
    by: ['paymentMethod'],
    where: { month, type: 'DEPOSIT', voidedAt: null, archivedAt: null },
    _sum: { amount: true },
    _count: { id: true },
  });
  const byMethod = methodGroups
    .map(g => ({
      method: g.paymentMethod || 'UNSPECIFIED',
      total: g._sum.amount || 0,
      count: g._count.id,
    }))
    .sort((a, b) => b.total - a.total);

  // Daily collection — past 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);
  const dailyRows = await prisma.$queryRaw<{ d: string; total: number }[]>`
    SELECT to_char("date", 'YYYY-MM-DD') AS d, SUM("amount")::float AS total
    FROM "fee_ledger"
    WHERE "type" = 'DEPOSIT' AND "voidedAt" IS NULL AND "date" >= ${thirtyDaysAgo}
    GROUP BY to_char("date", 'YYYY-MM-DD')
    ORDER BY d
  `;

  // Active students for context
  const totalStudents = await prisma.student.count();

  return Response.json({
    month,
    collectedThisMonth: collected._sum.amount || 0,
    depositsThisMonth: collected._count.id,
    chargedThisMonth: charged._sum.amount || 0,
    chargeEntriesThisMonth: charged._count.id,
    totalOutstanding,
    outstandingBreakdown,
    defaultersCount: owingRows.length,
    totalStudents,
    topDefaulters,
    byMethod,
    daily: dailyRows.map(r => ({ date: r.d, total: r.total })),
  });
}
