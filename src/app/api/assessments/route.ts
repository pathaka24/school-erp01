import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// Get assessments (filter by studentId, classId, academicYear)
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const studentId = searchParams.get('studentId');
  const classId = searchParams.get('classId');
  const academicYear = searchParams.get('academicYear') || '2025-2026';

  const where: any = { academicYear };
  if (studentId) where.studentId = studentId;
  if (classId) where.student = { classId };

  const assessments = await prisma.assessment.findMany({
    where,
    include: {
      student: { include: { user: { select: { firstName: true, lastName: true } } } },
      subject: { select: { id: true, name: true, code: true } },
    },
    orderBy: { subject: { name: 'asc' } },
  });
  return Response.json(assessments);
}

// Create or update assessment
export async function POST(request: NextRequest) {
  const { studentId, subjectId, academicYear, fa1, fa2, sa, grade, teacherRemark } = await request.json();

  const total = (fa1 || 0) + (fa2 || 0) + (sa || 0);
  const percentage = (total / 160) * 100;
  const autoGrade = grade || getGrade(percentage);

  const assessment = await prisma.assessment.upsert({
    where: { studentId_subjectId_academicYear: { studentId, subjectId, academicYear } },
    update: { fa1, fa2, sa, total, grade: autoGrade, teacherRemark },
    create: { studentId, subjectId, academicYear, fa1, fa2, sa, total, grade: autoGrade, teacherRemark },
    include: { subject: { select: { name: true, code: true } } },
  });
  return Response.json(assessment);
}

function getGrade(pct: number): string {
  if (pct >= 91) return 'A+';
  if (pct >= 81) return 'A';
  if (pct >= 71) return 'B+';
  if (pct >= 61) return 'B';
  if (pct >= 51) return 'C+';
  if (pct >= 41) return 'C';
  if (pct >= 33) return 'D';
  return 'E';
}
