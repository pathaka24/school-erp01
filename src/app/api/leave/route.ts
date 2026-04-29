import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/leave?studentId=&parentUserId=&teacherId=&status=
// teacherId returns leaves for students in any of the teacher's class-teacher sections.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const studentId = searchParams.get('studentId');
  const parentUserId = searchParams.get('parentUserId');
  const teacherId = searchParams.get('teacherId');
  const status = searchParams.get('status');

  const where: any = {};
  if (studentId) where.studentId = studentId;
  if (status) where.status = status;
  if (parentUserId) where.appliedById = parentUserId;
  if (teacherId) {
    const sections = await prisma.section.findMany({
      where: { classTeacherId: teacherId },
      select: { id: true },
    });
    where.student = { sectionId: { in: sections.map(s => s.id) } };
  }

  const leaves = await prisma.leaveApplication.findMany({
    where,
    include: {
      student: {
        include: {
          user: { select: { firstName: true, lastName: true } },
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      },
      appliedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });
  return Response.json(leaves);
}

// POST /api/leave — parent applies for leave
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { studentId, fromDate, toDate, reason, appliedById } = body;
  if (!studentId || !fromDate || !toDate || !reason || !appliedById) {
    return Response.json({ error: 'studentId, fromDate, toDate, reason, appliedById are required' }, { status: 400 });
  }
  if (new Date(toDate) < new Date(fromDate)) {
    return Response.json({ error: 'toDate must be on/after fromDate' }, { status: 400 });
  }

  const leave = await prisma.leaveApplication.create({
    data: {
      studentId,
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
      reason,
      appliedById,
    },
  });
  return Response.json(leave, { status: 201 });
}
