import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/behaviour?studentId=&teacherId=&type=&from=&to=
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const studentId = searchParams.get('studentId');
  const teacherId = searchParams.get('teacherId');
  const type = searchParams.get('type');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const where: any = {};
  if (studentId) where.studentId = studentId;
  if (teacherId) where.teacherId = teacherId;
  if (type) where.type = type;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }

  const logs = await prisma.behaviourLog.findMany({
    where,
    include: {
      student: {
        include: {
          user: { select: { firstName: true, lastName: true } },
          class: { select: { name: true } },
          section: { select: { name: true } },
        },
      },
      teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { date: 'desc' },
  });
  return Response.json(logs);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { studentId, teacherId, type, category, description, date, severity, parentNotified } = body;
  if (!studentId || !teacherId || !category || !description || !date) {
    return Response.json({ error: 'studentId, teacherId, category, description, date are required' }, { status: 400 });
  }

  const log = await prisma.behaviourLog.create({
    data: {
      studentId, teacherId,
      type: type || 'NEUTRAL',
      category,
      description,
      date: new Date(date),
      severity: severity ? Number(severity) : 1,
      parentNotified: parentNotified || false,
    },
  });
  return Response.json(log, { status: 201 });
}
