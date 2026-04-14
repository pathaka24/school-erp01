import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  const { examSubjectId, grades } = await request.json();

  const results = await Promise.all(
    grades.map((g: any) =>
      prisma.grade.upsert({
        where: { studentId_examSubjectId: { studentId: g.studentId, examSubjectId } },
        update: { marksObtained: g.marksObtained, grade: g.grade, remarks: g.remarks },
        create: { studentId: g.studentId, examSubjectId, marksObtained: g.marksObtained, grade: g.grade, remarks: g.remarks },
      })
    )
  );
  return Response.json({ message: 'Grades submitted', count: results.length });
}
