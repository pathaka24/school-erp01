import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return Response.json({ error: 'userId is required' }, { status: 400 });
  }

  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, avatar: true } },
      subjects: {
        select: { id: true, name: true, code: true, classId: true, class: { select: { id: true, name: true } } },
      },
      classSections: {
        include: {
          class: { select: { id: true, name: true, numericGrade: true } },
          students: {
            include: { user: { select: { firstName: true, lastName: true } } },
          },
        },
      },
    },
  });

  if (!teacher) {
    return Response.json({ error: 'Teacher not found' }, { status: 404 });
  }

  return Response.json(teacher);
}
