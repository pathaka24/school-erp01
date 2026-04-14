import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, avatar: true } },
      subjects: true,
      classSections: { include: { class: true, students: { include: { user: { select: { firstName: true, lastName: true } } } } } },
      timetableSlots: { include: { subject: { select: { name: true } }, section: { include: { class: { select: { name: true } } } } }, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
    },
  });
  if (!teacher) return Response.json({ error: 'Teacher not found' }, { status: 404 });
  return Response.json(teacher);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  // User fields
  const userFields: any = {};
  if (body.firstName !== undefined) userFields.firstName = body.firstName;
  if (body.lastName !== undefined) userFields.lastName = body.lastName;
  if (body.phone !== undefined) userFields.phone = body.phone;

  // Teacher fields
  const teacherFields: any = {};
  const allowed = [
    'qualification', 'specialization', 'experience', 'dateOfBirth', 'gender', 'bloodGroup',
    'aadhaarNumber', 'panNumber', 'address', 'city', 'state', 'pincode',
    'emergencyContact', 'emergencyPhone', 'bankName', 'bankAccount', 'ifscCode',
    'salary', 'designation', 'department', 'photo',
  ];
  for (const f of allowed) {
    if (body[f] !== undefined) {
      if (f === 'experience') teacherFields[f] = parseInt(body[f]) || 0;
      else if (f === 'salary') teacherFields[f] = parseFloat(body[f]) || null;
      else if (f === 'dateOfBirth') teacherFields[f] = body[f] ? new Date(body[f]) : null;
      else teacherFields[f] = body[f] || null;
    }
  }

  try {
    const teacher = await prisma.teacher.update({
      where: { id },
      data: {
        ...teacherFields,
        ...(Object.keys(userFields).length > 0 ? { user: { update: userFields } } : {}),
      },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } } },
    });
    return Response.json(teacher);
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Teacher not found' }, { status: 404 });
    return Response.json({ error: 'Failed to update teacher' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const teacher = await prisma.teacher.findUnique({ where: { id } });
    if (!teacher) return Response.json({ error: 'Teacher not found' }, { status: 404 });
    await prisma.user.delete({ where: { id: teacher.userId } });
    return Response.json({ message: 'Teacher deleted' });
  } catch {
    return Response.json({ error: 'Failed to delete teacher' }, { status: 500 });
  }
}
