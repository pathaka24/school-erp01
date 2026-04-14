import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const studentId = request.nextUrl.searchParams.get('studentId');
  const status = request.nextUrl.searchParams.get('status');
  const where: any = {};
  if (studentId) where.studentId = studentId;
  if (status) where.status = status;

  const payments = await prisma.payment.findMany({
    where,
    include: {
      student: { include: { user: { select: { firstName: true, lastName: true } } } },
      feeStructure: { select: { name: true, amount: true, academicYear: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return Response.json(payments);
}
