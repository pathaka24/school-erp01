import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const log = await prisma.teacherDailyLog.findUnique({
    where: { id },
    include: { teacher: { include: { user: { select: { firstName: true, lastName: true } } } } },
  });
  if (!log) return Response.json({ error: 'Daily log not found' }, { status: 404 });
  return Response.json(log);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const data: any = {};
  for (const k of ['summary', 'highlights', 'concerns', 'tomorrowPlan', 'mood', 'signature']) {
    if (body[k] !== undefined) data[k] = body[k] || null;
  }
  if (body.periodsTaught !== undefined) data.periodsTaught = body.periodsTaught != null ? Number(body.periodsTaught) : null;

  try {
    const log = await prisma.teacherDailyLog.update({ where: { id }, data });
    return Response.json(log);
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.teacherDailyLog.delete({ where: { id } });
    return Response.json({ message: 'Deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
