import { prisma } from '@/lib/db';

export async function GET() {
  const [items, orders] = await Promise.all([
    prisma.storeItem.findMany(),
    prisma.storeOrder.findMany({ where: { status: 'COMPLETED' } }),
  ]);

  const totalItems = items.length;
  const totalStockValue = items.reduce((s, i) => s + i.price * i.stock, 0);
  const lowStockItems = items.filter(i => i.stock <= i.minStock).length;
  const outOfStock = items.filter(i => i.stock === 0).length;
  const totalSales = orders.reduce((s, o) => s + o.netAmount, 0);
  const totalOrders = orders.length;

  // Sales by category
  const salesByCategory: Record<string, number> = {};
  // We need order items for this
  const orderItems = await prisma.storeOrderItem.findMany({
    where: { order: { status: 'COMPLETED' } },
    include: { item: { select: { category: true } } },
  });
  orderItems.forEach(oi => {
    salesByCategory[oi.item.category] = (salesByCategory[oi.item.category] || 0) + oi.total;
  });

  return Response.json({
    totalItems, totalStockValue, lowStockItems, outOfStock,
    totalSales, totalOrders, salesByCategory,
  });
}
