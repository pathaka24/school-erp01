import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      class: true,
      examSubjects: {
        include: {
          subject: true,
          grades: { include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } } },
        },
      },
    },
  });
  if (!exam) return Response.json({ error: 'Exam not found' }, { status: 404 });
  return Response.json(exam);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, type, startDate, endDate } = await request.json();
  const exam = await prisma.exam.update({
    where: { id },
    data: { name, type, startDate: startDate ? new Date(startDate) : undefined, endDate: endDate ? new Date(endDate) : undefined },
  });
  return Response.json(exam);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.exam.delete({ where: { id } });
  return Response.json({ message: 'Exam deleted' });
}
