import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const academicYear = request.nextUrl.searchParams.get('academicYear') || '2025-2026';

  // Income now comes from the FeeLedger (the real book) — every non-voided
  // DEPOSIT is money actually collected. The legacy Payment table is retired.
  const [deposits, expenses, salaries, pendingSalaries] = await Promise.all([
    prisma.feeLedger.findMany({ where: { type: 'DEPOSIT', voidedAt: null, archivedAt: null }, select: { amount: true, date: true } }),
    prisma.expense.findMany({ where: { academicYear } }),
    prisma.salary.findMany({ where: { status: 'PAID' } }),
    prisma.salary.findMany({ where: { status: 'PENDING' } }),
  ]);

  const totalIncome = deposits.reduce((s, p) => s + p.amount, 0);
  // Only the PAID portion of an expense is actual cash-out; the unpaid portion
  // is a pending liability that hasn't left the bank yet.
  const totalExpenses = expenses.reduce((s, e) => s + (e.paidAmount ?? e.amount), 0);
  const totalExpensesPending = expenses.reduce((s, e) => s + Math.max(0, e.amount - (e.paidAmount ?? e.amount)), 0);
  const totalSalariesPaid = salaries.reduce((s, sal) => s + sal.netPay, 0);
  const totalSalariesPending = pendingSalaries.reduce((s, sal) => s + sal.netPay, 0);
  const netBalance = totalIncome - totalExpenses - totalSalariesPaid;

  // Monthly breakdown
  const monthlyIncome: Record<string, number> = {};
  const monthlyExpenses: Record<string, number> = {};
  deposits.forEach(p => {
    const m = new Date(p.date).toISOString().slice(0, 7);
    monthlyIncome[m] = (monthlyIncome[m] || 0) + p.amount;
  });
  expenses.forEach(e => {
    const m = new Date(e.date).toISOString().slice(0, 7);
    monthlyExpenses[m] = (monthlyExpenses[m] || 0) + e.amount;
  });
  salaries.forEach(sal => {
    const m = sal.month;
    monthlyExpenses[m] = (monthlyExpenses[m] || 0) + sal.netPay;
  });

  // Expense by category (paid portion only)
  const byCategory: Record<string, number> = {};
  expenses.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + (e.paidAmount ?? e.amount);
  });
  // Add salaries as SALARY category
  byCategory['SALARY'] = (byCategory['SALARY'] || 0) + totalSalariesPaid;

  return Response.json({
    totalIncome,
    totalExpenses: totalExpenses + totalSalariesPaid,
    totalExpensesPending,
    totalSalariesPaid,
    totalSalariesPending,
    netBalance,
    byCategory,
    monthlyIncome,
    monthlyExpenses,
    recentPayments: deposits.length,
    recentExpenses: expenses.length,
  });
}
