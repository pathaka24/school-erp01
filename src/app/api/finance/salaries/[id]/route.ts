import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { status, paymentMode } = await request.json();

  try {
    const salary = await prisma.salary.update({
      where: { id },
      data: {
        status,
        ...(status === 'PAID' && { paidDate: new Date() }),
        ...(paymentMode && { paymentMode }),
      },
      include: { teacher: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });
    return Response.json(salary);
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.salary.delete({ where: { id } });
    return Response.json({ message: 'Deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
