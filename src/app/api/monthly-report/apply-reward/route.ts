import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// POST /api/monthly-report/apply-reward
// Apply monthly scholarship to student's fee ledger — reduces their balance
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { studentId, month, rewardAmount, description } = body;

  if (!studentId || !month || !rewardAmount || rewardAmount <= 0) {
    return Response.json({ error: 'studentId, month, and positive rewardAmount required' }, { status: 400 });
  }

  // Check if scholarship already applied for this month
  const existing = await prisma.feeLedger.findFirst({
    where: { studentId, month, category: { in: ['REWARD', 'SCHOLARSHIP'] } },
  });
  if (existing) {
    return Response.json({ error: 'Scholarship already applied for this month', existingEntry: existing }, { status: 409 });
  }

  // Get current balance
  const lastEntry = await prisma.feeLedger.findFirst({
    where: { studentId },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    select: { balanceAfter: true },
  });
  const currentBalance = lastEntry?.balanceAfter ?? 0;
  const newBalance = currentBalance - rewardAmount;

  const monthLabel = new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const entry = await prisma.feeLedger.create({
    data: {
      studentId,
      date: new Date(),
      month,
      type: 'DEPOSIT',
      category: 'SCHOLARSHIP',
      description: description || `Monthly scholarship - ${monthLabel}`,
      amount: rewardAmount,
      balanceAfter: newBalance,
    },
    include: {
      student: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
  });

  return Response.json(entry, { status: 201 });
}
