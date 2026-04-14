import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cls = await prisma.class.findUnique({
    where: { id },
    include: {
      sections: { include: { classTeacher: { include: { user: { select: { firstName: true, lastName: true } } } } } },
      subjects: { include: { teacher: { include: { user: { select: { firstName: true, lastName: true } } } } } },
      students: { include: { user: { select: { firstName: true, lastName: true } }, section: { select: { name: true } } } },
    },
  });
  if (!cls) return Response.json({ error: 'Class not found' }, { status: 404 });
  return Response.json(cls);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, numericGrade } = await request.json();
  const cls = await prisma.class.update({ where: { id }, data: { name, numericGrade }, include: { sections: true } });
  return Response.json(cls);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.class.delete({ where: { id } });
  return Response.json({ message: 'Class deleted' });
}
