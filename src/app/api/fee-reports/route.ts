import { prisma } from '@/lib/db';

export async function GET() {
  const [payments, feeStructures, students] = await Promise.all([
    prisma.payment.findMany({
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true, phone: true } }, class: { select: { name: true, numericGrade: true } } } },
        feeStructure: { select: { name: true, amount: true, feeType: true, classId: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.feeStructure.findMany({ include: { class: { select: { name: true, numericGrade: true } } } }),
    prisma.student.findMany({
      include: {
        user: { select: { firstName: true, lastName: true, phone: true } },
        class: { select: { id: true, name: true, numericGrade: true } },
        payments: { select: { amountPaid: true, status: true, paidDate: true } },
      },
    }),
  ]);

  // KPIs
  const totalBilled = feeStructures.reduce((s, f) => s + f.amount, 0);
  const paidPayments = payments.filter(p => p.status === 'PAID');
  const totalCollected = paidPayments.reduce((s, p) => s + p.amountPaid, 0);
  const totalOutstanding = totalBilled - totalCollected;

  // Overdue >30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const overduePayments = payments.filter(p => p.status === 'PENDING' && new Date(p.createdAt) < thirtyDaysAgo);
  const overdueAmount = overduePayments.reduce((s, p) => s + (p.feeStructure?.amount || 0) - p.amountPaid, 0);

  // Monthly collection trend
  const monthlyTrend: Record<string, { collected: number; billed: number }> = {};
  paidPayments.forEach(p => {
    const month = new Date(p.paidDate).toISOString().slice(0, 7);
    if (!monthlyTrend[month]) monthlyTrend[month] = { collected: 0, billed: 0 };
    monthlyTrend[month].collected += p.amountPaid;
  });

  // Class-wise
  const classWise: Record<string, any> = {};
  students.forEach(s => {
    const cls = s.class?.name || 'Unknown';
    if (!classWise[cls]) classWise[cls] = { students: 0, billed: 0, collected: 0, scholarshipCredits: 0 };
    classWise[cls].students++;
    const paid = s.payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amountPaid, 0);
    classWise[cls].collected += paid;
  });
  feeStructures.forEach(f => {
    const cls = f.class?.name || 'Unknown';
    if (classWise[cls]) classWise[cls].billed += f.amount;
  });

  // Fee type wise
  const feeTypeWise: Record<string, { total: number; collected: number; defaulters: number }> = {};
  feeStructures.forEach(f => {
    if (!feeTypeWise[f.feeType]) feeTypeWise[f.feeType] = { total: 0, collected: 0, defaulters: 0 };
    feeTypeWise[f.feeType].total += f.amount;
  });
  paidPayments.forEach(p => {
    const type = p.feeStructure?.feeType || 'MISC';
    if (feeTypeWise[type]) feeTypeWise[type].collected += p.amountPaid;
  });

  // Defaulters (students with no paid payments or overdue)
  const defaulters = students
    .filter(s => {
      const totalPaid = s.payments.filter((p: any) => p.status === 'PAID').reduce((sum: number, p: any) => sum + p.amountPaid, 0);
      return totalPaid === 0;
    })
    .map(s => ({
      id: s.id,
      name: `${s.user.firstName} ${s.user.lastName}`,
      class: s.class?.name,
      phone: s.user.phone,
      lastPayment: s.payments.length > 0 ? s.payments[s.payments.length - 1]?.paidDate : null,
    }));

  // ─── Payment Behavior Analytics (from ledger) ─────────────
  const ledgerEntries = await prisma.feeLedger.findMany({
    include: {
      student: {
        include: {
          user: { select: { firstName: true, lastName: true, phone: true } },
          class: { select: { name: true } },
          family: { select: { name: true } },
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  // Group ledger by student and compute behavior
  const studentLedgers: Record<string, {
    name: string; class: string; phone: string; family: string;
    totalCharges: number; totalDeposits: number; balance: number;
    depositCount: number; chargeMonths: number; lastDeposit: Date | null;
    monthsWithDeposit: Set<string>;
  }> = {};

  for (const entry of ledgerEntries) {
    const sid = entry.studentId;
    if (!studentLedgers[sid]) {
      studentLedgers[sid] = {
        name: `${entry.student.user.firstName} ${entry.student.user.lastName}`,
        class: entry.student.class?.name || '',
        phone: entry.student.user.phone || '',
        family: entry.student.family?.name || '',
        totalCharges: 0, totalDeposits: 0, balance: 0,
        depositCount: 0, chargeMonths: 0, lastDeposit: null,
        monthsWithDeposit: new Set(),
      };
    }
    const sl = studentLedgers[sid];
    if (entry.type === 'CHARGE') {
      sl.totalCharges += entry.amount;
      if (entry.category === 'MONTHLY_FEE') sl.chargeMonths++;
    } else if (entry.type === 'DEPOSIT') {
      sl.totalDeposits += entry.amount;
      sl.depositCount++;
      sl.lastDeposit = entry.date;
      sl.monthsWithDeposit.add(entry.month);
    }
    sl.balance = entry.balanceAfter;
  }

  // Compute payment behavior records
  const paymentBehavior = Object.entries(studentLedgers).map(([id, sl]) => {
    const regularity = sl.chargeMonths > 0
      ? Math.round((sl.monthsWithDeposit.size / sl.chargeMonths) * 100)
      : 0;
    const status = sl.balance <= 0 ? 'CLEAR'
      : regularity >= 80 ? 'REGULAR'
      : regularity >= 40 ? 'IRREGULAR'
      : 'DEFAULTER';

    return {
      id,
      name: sl.name,
      class: sl.class,
      phone: sl.phone,
      family: sl.family,
      totalCharges: sl.totalCharges,
      totalDeposits: sl.totalDeposits,
      balance: sl.balance,
      depositCount: sl.depositCount,
      regularity,
      lastDeposit: sl.lastDeposit,
      status,
    };
  }).sort((a, b) => b.balance - a.balance);

  return Response.json({
    kpis: { totalBilled, totalCollected, totalOutstanding, overdueAmount, overdueCount: overduePayments.length },
    monthlyTrend: Object.entries(monthlyTrend).sort().map(([month, d]) => ({ month, ...d, rate: d.billed > 0 ? (d.collected / d.billed * 100) : 0 })),
    classWise: Object.entries(classWise).map(([cls, d]) => ({ class: cls, ...d, collectionPct: d.billed > 0 ? (d.collected / d.billed * 100).toFixed(1) : '0' })),
    feeTypeWise: Object.entries(feeTypeWise).map(([type, d]) => ({ type, ...d })),
    defaulters,
    transactions: payments.slice(0, 100),
    paymentBehavior,
  });
}
