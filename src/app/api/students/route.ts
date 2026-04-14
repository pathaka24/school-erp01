import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const classId = searchParams.get('classId');
  const sectionId = searchParams.get('sectionId');
  const search = searchParams.get('search');

  const where: any = {};
  if (classId) where.classId = classId;
  if (sectionId) where.sectionId = sectionId;
  if (search) {
    where.user = {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  const students = await prisma.student.findMany({
    where,
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, avatar: true } },
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
    },
    orderBy: { user: { firstName: 'asc' } },
  });
  return Response.json(students);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password, firstName, lastName, phone, admissionNo, dateOfBirth, gender, currentAddress, bloodGroup, classId, sectionId, parentId } = body;

  const passwordHash = await bcrypt.hash(password || 'student123', 12);

  try {
    const student = await prisma.student.create({
      data: {
        admissionNo,
        dateOfBirth: new Date(dateOfBirth),
        gender,
        currentAddress,
        bloodGroup,
        class: { connect: { id: classId } },
        section: { connect: { id: sectionId } },
        ...(parentId ? { parent: { connect: { id: parentId } } } : {}),
        user: {
          create: { email, passwordHash, firstName, lastName, phone, role: Role.STUDENT },
        },
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
    });
    return Response.json(student, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return Response.json({ error: 'Email or admission number already exists' }, { status: 409 });
    }
    return Response.json({ error: 'Failed to create student' }, { status: 500 });
  }
}
