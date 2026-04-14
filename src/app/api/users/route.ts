import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const role = searchParams.get('role');
  const search = searchParams.get('search');

  const where: any = {};
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
    orderBy: { createdAt: 'desc' },
  });
  return Response.json(users);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password, firstName, lastName, phone, role } = body;

  if (!email || !firstName || !lastName || !role) {
    return Response.json({ error: 'Email, first name, last name, and role are required' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password || 'password123', 12);

  try {
    const user = await prisma.user.create({
      data: { email, passwordHash, firstName, lastName, phone, role },
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
    return Response.json(user, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return Response.json({ error: 'Email already exists' }, { status: 409 });
    }
    return Response.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
