import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { requireScope } from '@/lib/apiAuth';

const USER_SELECT = {
  id: true, email: true, firstName: true, lastName: true,
  role: true, phone: true, isActive: true, permissions: true, createdAt: true,
} as any;

export async function GET(request: NextRequest) {
  const auth = await requireScope(request, 'users');
  if (auth instanceof Response) return auth;

  const { searchParams } = request.nextUrl;
  const role = searchParams.get('role');
  const search = searchParams.get('search');
  const includeInactive = searchParams.get('includeInactive') === 'true';

  const where: any = {};
  if (!includeInactive) where.isActive = true;
  if (role) where.role = role;
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    select: USER_SELECT,
    orderBy: { createdAt: 'desc' },
  });
  return Response.json(users);
}

// Create a STAFF / TEACHER / PARENT user with optional permissions.
// ADMIN only.
export async function POST(request: NextRequest) {
  const auth = await requireScope(request, 'users');
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const { email, password, firstName, lastName, phone, role, permissions } = body;

  if (!email || !firstName || !lastName || !role) {
    return Response.json({ error: 'Email, first name, last name, and role are required' }, { status: 400 });
  }
  if (!['ADMIN', 'TEACHER', 'PARENT', 'STUDENT', 'STAFF'].includes(role)) {
    return Response.json({ error: 'Invalid role' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password || 'password123', 12);

  try {
    const user = await prisma.user.create({
      data: {
        email, passwordHash, firstName, lastName, phone, role,
        permissions: Array.isArray(permissions) ? permissions : [],
      } as any,
      select: USER_SELECT,
    });
    return Response.json(user, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return Response.json({ error: 'Email already exists' }, { status: 409 });
    }
    return Response.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
