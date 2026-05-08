import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { parsePageParams, pageResponse } from '@/lib/pagination';
import { requireScope } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const classId = searchParams.get('classId');
  const sectionId = searchParams.get('sectionId');
  const search = searchParams.get('search');
  // Backwards compat: if no `limit` is provided, return ALL rows (legacy callers).
  // New paginated callers pass `?limit=50&offset=0`.
  const wantsPaginated = searchParams.has('limit') || searchParams.has('offset') || searchParams.has('page');

  // Use isActive (existing field) to hide soft-deleted students.
  // The DELETE endpoint sets both isActive=false and deletedAt=now;
  // once `prisma generate` is run we could also filter on deletedAt directly.
  const where: any = {
    user: { isActive: true },
  };
  if (classId) where.classId = classId;
  if (sectionId) where.sectionId = sectionId;
  if (search) {
    where.user = {
      ...where.user,
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  if (!wantsPaginated) {
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

  const params = parsePageParams(request);
  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, avatar: true } },
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
      orderBy: { user: { firstName: 'asc' } },
      take: params.limit,
      skip: params.offset,
    }),
    prisma.student.count({ where }),
  ]);
  return Response.json(pageResponse(students, total, params));
}

export async function POST(request: NextRequest) {
  const auth = await requireScope(request, 'students');
  if (auth instanceof Response) return auth;

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
