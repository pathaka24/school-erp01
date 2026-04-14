import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;

  const txns = await prisma.scholarshipTransaction.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
  });

  return Response.json(txns);
}
