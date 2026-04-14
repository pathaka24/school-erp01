import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const families = await prisma.family.findMany({
    include: {
      students: {
        include: {
          user: { select: { firstName: true, lastName: true } },
          class: { select: { name: true } },
          section: { select: { name: true } },
          payments: { where: { status: 'PAID' }, select: { amountPaid: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const result = families.map(f => ({
    ...f,
    totalStudents: f.students.length,
    totalPaid: f.students.reduce((sum, s) => sum + s.payments.reduce((ps, p) => ps + p.amountPaid, 0), 0),
  }));

  return Response.json(result);
}

export async function POST(request: NextRequest) {
  const { name, studentIds } = await request.json();
  const familyId = `FAM-${Date.now()}`;

  const family = await prisma.family.create({
    data: { familyId, name },
  });

  if (studentIds?.length) {
    await prisma.student.updateMany({
      where: { id: { in: studentIds } },
      data: { familyId: family.id },
    });
  }

  return Response.json(family, { status: 201 });
}
