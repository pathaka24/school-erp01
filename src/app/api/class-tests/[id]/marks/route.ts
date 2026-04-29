import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// POST /api/class-tests/[id]/marks — batch upsert marks for the test
// Body: { marks: [{ studentId, marksObtained, remarks? }, ...] }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: classTestId } = await params;
  const body = await request.json();
  const { marks } = body;

  if (!Array.isArray(marks)) {
    return Response.json({ error: 'marks must be an array' }, { status: 400 });
  }

  const test = await prisma.classTest.findUnique({ where: { id: classTestId }, select: { id: true, maxMarks: true } });
  if (!test) return Response.json({ error: 'Class test not found' }, { status: 404 });

  for (const m of marks) {
    if (!m.studentId || m.marksObtained === undefined || m.marksObtained === null || m.marksObtained === '') continue;
    const score = Number(m.marksObtained);
    if (Number.isNaN(score)) {
      return Response.json({ error: `Invalid marks for student ${m.studentId}` }, { status: 400 });
    }
    if (score < 0 || score > test.maxMarks) {
      return Response.json(
        { error: `Marks for student ${m.studentId} must be between 0 and ${test.maxMarks}` },
        { status: 400 }
      );
    }
  }

  const results = await Promise.all(
    marks
      .filter((m: any) => m.studentId && m.marksObtained !== undefined && m.marksObtained !== null && m.marksObtained !== '')
      .map((m: any) =>
        prisma.classTestMark.upsert({
          where: { classTestId_studentId: { classTestId, studentId: m.studentId } },
          update: { marksObtained: Number(m.marksObtained), remarks: m.remarks || null },
          create: {
            classTestId,
            studentId: m.studentId,
            marksObtained: Number(m.marksObtained),
            remarks: m.remarks || null,
          },
        })
      )
  );

  return Response.json({ message: 'Marks saved', count: results.length });
}
