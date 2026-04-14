import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const studentId = request.nextUrl.searchParams.get('studentId');
  const academicYear = request.nextUrl.searchParams.get('academicYear') || '2025-2026';
  if (!studentId) return Response.json({ error: 'studentId required' }, { status: 400 });

  const records = await prisma.coScholastic.findMany({
    where: { studentId, academicYear },
    orderBy: { activity: 'asc' },
  });
  return Response.json(records);
}

export async function POST(request: NextRequest) {
  const { studentId, academicYear, activity, grade } = await request.json();
  const record = await prisma.coScholastic.upsert({
    where: { studentId_activity_academicYear: { studentId, activity, academicYear } },
    update: { grade },
    create: { studentId, academicYear, activity, grade },
  });
  return Response.json(record);
}
