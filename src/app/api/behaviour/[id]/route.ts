import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const data: any = {};
  for (const k of ['type', 'category', 'description', 'parentNotified']) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  if (body.severity !== undefined) data.severity = Number(body.severity);
  if (body.date !== undefined) data.date = new Date(body.date);

  try {
    const log = await prisma.behaviourLog.update({ where: { id }, data });
    return Response.json(log);
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Log not found' }, { status: 404 });
    return Response.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.behaviourLog.delete({ where: { id } });
    return Response.json({ message: 'Log deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Log not found' }, { status: 404 });
    return Response.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
