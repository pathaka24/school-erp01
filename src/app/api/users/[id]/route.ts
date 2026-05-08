import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireScope } from '@/lib/apiAuth';

const USER_SELECT = {
  id: true, email: true, firstName: true, lastName: true,
  role: true, phone: true, isActive: true, permissions: true, createdAt: true,
} as any;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });
  return Response.json(user);
}

// Update a user. ADMIN only — covers role, permissions, name, phone, active flag, email.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireScope(request, 'users');
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();
  const { firstName, lastName, phone, role, isActive, permissions, email } = body;

  // Don't let admin lock themselves out by deactivating their own account
  if (isActive === false && auth.userId === id) {
    return Response.json({ error: 'You cannot deactivate your own account.' }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(role !== undefined && { role }),
        ...(isActive !== undefined && { isActive }),
        ...(email !== undefined && { email }),
        ...(Array.isArray(permissions) && { permissions } as any),
      } as any,
      select: USER_SELECT,
    });
    return Response.json(user);
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'User not found' }, { status: 404 });
    if (error.code === 'P2002') return Response.json({ error: 'Email already in use' }, { status: 409 });
    return Response.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// Soft-delete (deactivate). Hard delete only via ?hard=true.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireScope(request, 'users');
  if (auth instanceof Response) return auth;

  const { id } = await params;
  if (auth.userId === id) {
    return Response.json({ error: 'You cannot delete your own account.' }, { status: 400 });
  }

  const hard = request.nextUrl.searchParams.get('hard') === 'true';

  try {
    if (hard) {
      await prisma.user.delete({ where: { id } });
      return Response.json({ deleted: true });
    }
    await prisma.user.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date(), deletedBy: auth.userId } as any,
    });
    return Response.json({ deactivated: true });
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'User not found' }, { status: 404 });
    return Response.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
