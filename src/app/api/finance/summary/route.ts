import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const academicYear = request.nextUrl.searchParams.get('academicYear') || '2025-2026';

  const [payments, expenses, salaries, pendingSalaries] = await Promise.all([
    prisma.payment.findMany({ where: { status: 'PAID' } }),
    prisma.expense.findMany({ where: { academicYear } }),
    prisma.salary.findMany({ where: { status: 'PAID' } }),
    prisma.salary.findMany({ where: { status: 'PENDING' } }),
  ]);

  const totalIncome = payments.reduce((s, p) => s + p.amountPaid, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalSalariesPaid = salaries.reduce((s, sal) => s + sal.netPay, 0);
  const totalSalariesPending = pendingSalaries.reduce((s, sal) => s + sal.netPay, 0);
  const netBalance = totalIncome - totalExpenses - totalSalariesPaid;

  // Monthly breakdown
  const monthlyIncome: Record<string, number> = {};
  const monthlyExpenses: Record<string, number> = {};
  payments.forEach(p => {
    const m = new Date(p.paidDate).toISOString().slice(0, 7);
    monthlyIncome[m] = (monthlyIncome[m] || 0) + p.amountPaid;
  });
  expenses.forEach(e => {
    const m = new Date(e.date).toISOString().slice(0, 7);
    monthlyExpenses[m] = (monthlyExpenses[m] || 0) + e.amount;
  });
  salaries.forEach(sal => {
    const m = sal.month;
    monthlyExpenses[m] = (monthlyExpenses[m] || 0) + sal.netPay;
  });

  // Expense by category
  const byCategory: Record<string, number> = {};
  expenses.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  });
  // Add salaries as SALARY category
  byCategory['SALARY'] = (byCategory['SALARY'] || 0) + totalSalariesPaid;

  return Response.json({
    totalIncome,
    totalExpenses: totalExpenses + totalSalariesPaid,
    totalSalariesPaid,
    totalSalariesPending,
    netBalance,
    byCategory,
    monthlyIncome,
    monthlyExpenses,
    recentPayments: payments.length,
    recentExpenses: expenses.length,
  });
}
