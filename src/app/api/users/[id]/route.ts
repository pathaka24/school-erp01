import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      phone: true,
      isActive: true,
      createdAt: true,
    },
  });
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });
  return Response.json(user);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { firstName, lastName, phone, role, isActive } = body;

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(role !== undefined && { role }),
        ...(isActive !== undefined && { isActive }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    });
    return Response.json(user);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    return Response.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.user.delete({ where: { id } });
    return Response.json({ message: 'User deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }
    return Response.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
