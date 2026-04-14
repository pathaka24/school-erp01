import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const category = searchParams.get('category');
  const search = searchParams.get('search');
  const lowStock = searchParams.get('lowStock');

  const where: any = {};
  if (category) where.category = category;
  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  const items = await prisma.storeItem.findMany({
    where,
    orderBy: { name: 'asc' },
  });

  // Filter low stock in JS (stock <= minStock)
  if (lowStock === 'true') {
    return Response.json(items.filter(i => i.stock <= i.minStock));
  }

  return Response.json(items);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, category, description, price, stock, minStock, unit, supplier } = body;

  if (!name || !category || !price) {
    return Response.json({ error: 'Name, category, and price are required' }, { status: 400 });
  }

  const item = await prisma.storeItem.create({
    data: {
      name, category, description,
      price: parseFloat(price),
      stock: parseInt(stock) || 0,
      minStock: parseInt(minStock) || 5,
      unit: unit || 'pcs',
      supplier,
    },
  });
  return Response.json(item, { status: 201 });
}
