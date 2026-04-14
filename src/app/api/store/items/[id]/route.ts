import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { name, description, price, stock, minStock, unit, supplier, isActive } = body;

  try {
    const item = await prisma.storeItem.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(stock !== undefined && { stock: parseInt(stock) }),
        ...(minStock !== undefined && { minStock: parseInt(minStock) }),
        ...(unit !== undefined && { unit }),
        ...(supplier !== undefined && { supplier }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    return Response.json(item);
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Item not found' }, { status: 404 });
    return Response.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.storeItem.delete({ where: { id } });
    return Response.json({ message: 'Deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
