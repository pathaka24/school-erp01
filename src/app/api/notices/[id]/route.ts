import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notice = await prisma.notice.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, firstName: true, lastName: true, role: true } },
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  });
  if (!notice) return Response.json({ error: 'Notice not found' }, { status: 404 });
  return Response.json(notice);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const data: any = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.body !== undefined) data.body = body.body;
  if (body.audience !== undefined) data.audience = body.audience;
  if (body.classId !== undefined) data.classId = body.classId || null;
  if (body.sectionId !== undefined) data.sectionId = body.sectionId || null;
  if (body.isPinned !== undefined) data.isPinned = body.isPinned;
  if (body.publishedAt !== undefined) data.publishedAt = new Date(body.publishedAt);
  if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  try {
    const notice = await prisma.notice.update({ where: { id }, data });
    return Response.json(notice);
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Notice not found' }, { status: 404 });
    return Response.json({ error: 'Failed to update notice' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.notice.delete({ where: { id } });
    return Response.json({ message: 'Notice deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Notice not found' }, { status: 404 });
    return Response.json({ error: 'Failed to delete notice' }, { status: 500 });
  }
}
