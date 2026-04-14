import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('search');
  const where: any = {};
  if (search) {
    where.user = {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  const teachers = await prisma.teacher.findMany({
    where,
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, avatar: true } },
      subjects: { select: { id: true, name: true, code: true } },
    },
    orderBy: { user: { firstName: 'asc' } },
  });
  return Response.json(teachers);
}

export async function POST(request: NextRequest) {
  const { email, password, firstName, lastName, phone, employeeId, qualification, experience } = await request.json();
  const passwordHash = await bcrypt.hash(password || 'teacher123', 12);

  try {
    const teacher = await prisma.teacher.create({
      data: {
        employeeId,
        qualification,
        experience,
        user: { create: { email, passwordHash, firstName, lastName, phone, role: Role.TEACHER } },
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
      },
    });
    return Response.json(teacher, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') return Response.json({ error: 'Email or employee ID already exists' }, { status: 409 });
    return Response.json({ error: 'Failed to create teacher' }, { status: 500 });
  }
}
