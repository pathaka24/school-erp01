import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const examId = request.nextUrl.searchParams.get('examId');

  const where: any = { studentId: id };
  if (examId) where.examSubject = { examId };

  const grades = await prisma.grade.findMany({
    where,
    include: {
      examSubject: {
        include: {
          exam: { select: { id: true, name: true, type: true, startDate: true } },
          subject: { select: { id: true, name: true, code: true } },
        },
      },
    },
    orderBy: { examSubject: { exam: { startDate: 'desc' } } },
  });
  return Response.json(grades);
}
