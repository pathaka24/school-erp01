import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const studentId = request.nextUrl.searchParams.get('studentId');
  const academicYear = request.nextUrl.searchParams.get('academicYear') || '2025-2026';
  if (!studentId) return Response.json({ error: 'studentId required' }, { status: 400 });

  const records = await prisma.personalQuality.findMany({
    where: { studentId, academicYear },
    orderBy: { quality: 'asc' },
  });
  return Response.json(records);
}

export async function POST(request: NextRequest) {
  const { studentId, academicYear, quality, grade } = await request.json();
  const record = await prisma.personalQuality.upsert({
    where: { studentId_quality_academicYear: { studentId, quality, academicYear } },
    update: { grade },
    create: { studentId, academicYear, quality, grade },
  });
  return Response.json(record);
}
