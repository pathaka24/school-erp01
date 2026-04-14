import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// Get all assessments for a student across years
export async function GET(request: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const academicYear = request.nextUrl.searchParams.get('academicYear');

  const where: any = { studentId };
  if (academicYear) where.academicYear = academicYear;

  const assessments = await prisma.assessment.findMany({
    where,
    include: { subject: { select: { id: true, name: true, code: true } } },
    orderBy: [{ academicYear: 'desc' }, { subject: { name: 'asc' } }],
  });

  // Calculate summary
  const byYear: Record<string, any[]> = {};
  assessments.forEach(a => {
    if (!byYear[a.academicYear]) byYear[a.academicYear] = [];
    byYear[a.academicYear].push(a);
  });

  const summaries = Object.entries(byYear).map(([year, items]) => {
    const totalMarks = items.reduce((s, a) => s + (a.total || 0), 0);
    const maxMarks = items.length * 160;
    const percentage = maxMarks > 0 ? (totalMarks / maxMarks) * 100 : 0;
    return { year, subjects: items, totalMarks, maxMarks, percentage: percentage.toFixed(1), grade: getGrade(percentage) };
  });

  return Response.json(summaries);
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
