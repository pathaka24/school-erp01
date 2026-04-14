import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { status } = await request.json();

  const order = await prisma.storeOrder.findUnique({ where: { id }, include: { items: true } });
  if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });

  // If cancelling/refunding, restore stock
  if ((status === 'CANCELLED' || status === 'REFUNDED') && order.status === 'COMPLETED') {
    for (const item of order.items) {
      await prisma.storeItem.update({
        where: { id: item.itemId },
        data: { stock: { increment: item.quantity } },
      });
    }
  }

  const updated = await prisma.storeOrder.update({
    where: { id },
    data: { status },
    include: {
      student: { include: { user: { select: { firstName: true, lastName: true } } } },
      items: { include: { item: { select: { name: true, category: true } } } },
    },
  });
  return Response.json(updated);
}
