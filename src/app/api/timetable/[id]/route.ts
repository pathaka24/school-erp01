import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { subjectId, teacherId, dayOfWeek, startTime, endTime, room } = await request.json();
  const slot = await prisma.timetable.update({ where: { id }, data: { subjectId, teacherId, dayOfWeek, startTime, endTime, room } });
  return Response.json(slot);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.timetable.delete({ where: { id } });
  return Response.json({ message: 'Timetable slot deleted' });
}
