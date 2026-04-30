import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/parent/me?userId=xxx
// Returns the logged-in parent's full record plus children with light stats
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return Response.json({ error: 'userId required' }, { status: 400 });

  const parent = await prisma.parent.findUnique({
    where: { userId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true } },
    },
  });
  if (!parent) return Response.json({ error: 'Parent not found' }, { status: 404 });

  // Direct children
  let students = await prisma.student.findMany({
    where: { parentId: parent.id },
    include: {
      user: { select: { firstName: true, lastName: true } },
      class: { select: { name: true } },
      section: { select: { name: true } },
    },
  });

  // Also pull family siblings if any
  const familyIds = students.map(s => s.familyId).filter((id): id is string => !!id);
  if (familyIds.length > 0) {
    const sibs = await prisma.student.findMany({
      where: { familyId: { in: familyIds }, id: { notIn: students.map(s => s.id) } },
      include: {
        user: { select: { firstName: true, lastName: true } },
        class: { select: { name: true } },
        section: { select: { name: true } },
      },
    });
    students = [...students, ...sibs];
  }

  return Response.json({
    parent: {
      id: parent.id,
      userId: parent.user.id,
      firstName: parent.user.firstName,
      lastName: parent.user.lastName,
      email: parent.user.email,
      phone: parent.user.phone,
      avatar: parent.user.avatar,
      occupation: parent.occupation,
      relationship: parent.relationship,
    },
    children: students.map(s => ({
      id: s.id,
      name: `${s.user.firstName} ${s.user.lastName}`,
      admissionNo: s.admissionNo,
      className: s.class.name,
      sectionName: s.section.name,
      rollNumber: s.rollNumber,
      photo: s.photo,
    })),
  });
}

// PUT /api/parent/me — parent updates their own profile
// Body: { userId, firstName?, lastName?, phone?, occupation?, relationship? }
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { userId, firstName, lastName, phone, occupation, relationship } = body;
  if (!userId) return Response.json({ error: 'userId required' }, { status: 400 });

  const parent = await prisma.parent.findUnique({ where: { userId } });
  if (!parent) return Response.json({ error: 'Parent not found' }, { status: 404 });

  // Update User fields
  if (firstName !== undefined || lastName !== undefined || phone !== undefined) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone: phone || null }),
      },
    });
  }

  // Update Parent fields
  if (occupation !== undefined || relationship !== undefined) {
    await prisma.parent.update({
      where: { id: parent.id },
      data: {
        ...(occupation !== undefined && { occupation: occupation || null }),
        ...(relationship !== undefined && { relationship: relationship || null }),
      },
    });
  }

  return Response.json({ ok: true });
}
