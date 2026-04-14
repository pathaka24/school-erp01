import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const family = await prisma.family.findUnique({
    where: { id },
    include: {
      students: {
        include: {
          user: { select: { firstName: true, lastName: true, email: true, phone: true } },
          class: { select: { id: true, name: true } },
          section: { select: { name: true } },
          payments: {
            include: { feeStructure: { select: { name: true, amount: true, feeType: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
  });
  if (!family) return Response.json({ error: 'Family not found' }, { status: 404 });
  return Response.json(family);
}

// Add student to family
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { studentId } = await request.json();
  await prisma.student.update({ where: { id: studentId }, data: { familyId: id } });
  return Response.json({ message: 'Student added to family' });
}
