import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const studentId = searchParams.get('studentId');
  const status = searchParams.get('status');

  const where: any = {};
  if (studentId) where.studentId = studentId;
  if (status) where.status = status;

  const orders = await prisma.storeOrder.findMany({
    where,
    include: {
      student: { include: { user: { select: { firstName: true, lastName: true } } } },
      items: { include: { item: { select: { name: true, category: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return Response.json(orders);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { studentId, buyerName, buyerType, items, discount, paymentMethod, notes } = body;

  if (!items || items.length === 0) {
    return Response.json({ error: 'At least one item is required' }, { status: 400 });
  }

  // Fetch item prices and validate stock
  const itemIds = items.map((i: any) => i.itemId);
  const storeItems = await prisma.storeItem.findMany({ where: { id: { in: itemIds } } });
  const itemMap = new Map(storeItems.map(i => [i.id, i]));

  let totalAmount = 0;
  const orderItems: { itemId: string; quantity: number; unitPrice: number; total: number }[] = [];

  for (const cartItem of items) {
    const dbItem = itemMap.get(cartItem.itemId);
    if (!dbItem) return Response.json({ error: `Item not found: ${cartItem.itemId}` }, { status: 400 });
    if (dbItem.stock < cartItem.quantity) {
      return Response.json({ error: `Insufficient stock for ${dbItem.name} (available: ${dbItem.stock})` }, { status: 400 });
    }
    const lineTotal = dbItem.price * cartItem.quantity;
    totalAmount += lineTotal;
    orderItems.push({ itemId: cartItem.itemId, quantity: cartItem.quantity, unitPrice: dbItem.price, total: lineTotal });
  }

  const discountAmt = parseFloat(discount) || 0;
  const netAmount = totalAmount - discountAmt;
  const orderNumber = `ORD-${Date.now()}`;

  // Use transaction to ensure order + stock deduction are atomic
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.storeOrder.create({
      data: {
        orderNumber,
        studentId: studentId || null,
        buyerName: buyerName || null,
        buyerType: buyerType || 'STUDENT',
        totalAmount,
        discount: discountAmt,
        netAmount,
        paymentMethod,
        notes,
        items: { create: orderItems },
      },
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true } } } },
        items: { include: { item: { select: { name: true, category: true } } } },
      },
    });

    for (const cartItem of items) {
      await tx.storeItem.update({
        where: { id: cartItem.itemId },
        data: { stock: { decrement: cartItem.quantity } },
      });
    }

    return created;
  });

  return Response.json(order, { status: 201 });
}
