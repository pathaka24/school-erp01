import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;

  let wallet = await prisma.scholarshipWallet.findUnique({ where: { studentId } });
  if (!wallet) {
    wallet = await prisma.scholarshipWallet.create({ data: { studentId, balance: 0, tier: 'NONE' } });
  }

  const txns = await prisma.scholarshipTransaction.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
    take: 12,
  });

  const totalCredited = txns.filter(t => t.type === 'CREDIT').reduce((s, t) => s + t.amount, 0);
  const totalDebited = txns.filter(t => t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0);

  return Response.json({ wallet, recentTransactions: txns, totalCredited, totalDebited });
}
