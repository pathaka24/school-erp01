import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await prisma.calendarEvent.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  });
  if (!event) return Response.json({ error: 'Event not found' }, { status: 404 });
  return Response.json(event);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const data: any = {};
  for (const k of ['title', 'description', 'startTime', 'endTime', 'type', 'audience', 'location', 'color']) {
    if (body[k] !== undefined) data[k] = body[k] || null;
  }
  if (body.startDate) data.startDate = new Date(body.startDate);
  if (body.endDate) data.endDate = new Date(body.endDate);
  if (body.classId !== undefined) data.classId = body.classId || null;
  if (body.sectionId !== undefined) data.sectionId = body.sectionId || null;

  try {
    const event = await prisma.calendarEvent.update({ where: { id }, data });
    return Response.json(event);
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Event not found' }, { status: 404 });
    return Response.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.calendarEvent.delete({ where: { id } });
    return Response.json({ message: 'Event deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Event not found' }, { status: 404 });
    return Response.json({ error: 'Failed to delete event' }, { status: 500 });
  }
}
