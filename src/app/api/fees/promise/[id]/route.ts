import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireScope } from '@/lib/apiAuth';

// PATCH /api/fees/promise/[id]  { status?, promisedDate?, amount?, reason? }
// Update a follow-up — mark PAID / BROKEN / CANCELLED, or reschedule.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();
  const data: any = {};
  if (body.status && ['PENDING', 'PAID', 'BROKEN', 'CANCELLED'].includes(body.status)) data.status = body.status;
  if (body.promisedDate) { const d = new Date(body.promisedDate); if (!isNaN(d.getTime())) data.promisedDate = d; }
  if (body.amount !== undefined) data.amount = body.amount === '' || body.amount == null ? null : parseFloat(body.amount);
  if (body.reason !== undefined) data.reason = body.reason ? String(body.reason).trim() : null;
  if (Object.keys(data).length === 0) return Response.json({ error: 'Nothing to update' }, { status: 400 });

  try {
    const updated = await prisma.feePromise.update({ where: { id }, data });
    return Response.json(updated);
  } catch (e: any) {
    if (e.code === 'P2025') return Response.json({ error: 'Promise not found' }, { status: 404 });
    return Response.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireScope(_request, 'fees');
  if (auth instanceof Response) return auth;
  const { id } = await params;
  try {
    await prisma.feePromise.delete({ where: { id } });
    return Response.json({ message: 'Deleted' });
  } catch (e: any) {
    if (e.code === 'P2025') return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
