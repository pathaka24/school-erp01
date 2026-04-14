import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const student = await prisma.student.findUnique({ where: { id }, select: { classId: true } });
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });

  const feeStructures = await prisma.feeStructure.findMany({
    where: { classId: student.classId },
    include: { payments: { where: { studentId: id } } },
    orderBy: { dueDate: 'asc' },
  });

  const feesWithStatus = feeStructures.map((fee: any) => {
    const payment = fee.payments[0];
    return {
      id: fee.id, name: fee.name, amount: fee.amount, dueDate: fee.dueDate,
      academicYear: fee.academicYear, status: payment?.status || 'PENDING',
      paidAmount: payment?.amountPaid || 0, paidDate: payment?.paidDate,
    };
  });

  return Response.json(feesWithStatus);
}
