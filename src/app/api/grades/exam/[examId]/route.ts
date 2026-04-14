import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;

  const grades = await prisma.grade.findMany({
    where: { examSubject: { examId } },
    include: {
      student: { include: { user: { select: { firstName: true, lastName: true } } } },
      examSubject: { include: { subject: { select: { name: true, code: true } } } },
    },
    orderBy: { student: { user: { firstName: 'asc' } } },
  });
  return Response.json(grades);
}
