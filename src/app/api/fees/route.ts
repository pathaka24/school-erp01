import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const classId = request.nextUrl.searchParams.get('classId');
  const academicYear = request.nextUrl.searchParams.get('academicYear');
  const where: any = {};
  if (classId) where.classId = classId;
  if (academicYear) where.academicYear = academicYear;

  const fees = await prisma.feeStructure.findMany({
    where,
    include: { class: { select: { id: true, name: true } }, _count: { select: { payments: true } } },
    orderBy: { dueDate: 'asc' },
  });
  return Response.json(fees);
}

export async function POST(request: NextRequest) {
  const { name, classId, feeType, amount, frequency, dueDate, academicYear, description, isOptional } = await request.json();
  const fee = await prisma.feeStructure.create({
    data: {
      name, classId, amount, dueDate: new Date(dueDate), academicYear, description,
      ...(feeType && { feeType }),
      ...(frequency && { frequency }),
      ...(isOptional !== undefined && { isOptional }),
    },
    include: { class: { select: { id: true, name: true } } },
  });
  return Response.json(fee, { status: 201 });
}
