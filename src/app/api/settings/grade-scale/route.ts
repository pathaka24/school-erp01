import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const grades = await prisma.gradeScale.findMany({ orderBy: { order: 'asc' } });
  return Response.json(grades);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, minMarks, maxMarks, gpa, remarks, order } = body;

  if (!name || minMarks === undefined || maxMarks === undefined) {
    return Response.json({ error: 'Name, min marks, and max marks are required' }, { status: 400 });
  }

  try {
    const grade = await prisma.gradeScale.create({
      data: {
        name,
        minMarks: parseFloat(minMarks),
        maxMarks: parseFloat(maxMarks),
        gpa: gpa ? parseFloat(gpa) : null,
        remarks,
        order: order || 0,
      },
    });
    return Response.json(grade, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') return Response.json({ error: 'Grade name already exists' }, { status: 409 });
    return Response.json({ error: 'Failed to create grade' }, { status: 500 });
  }
}

// Bulk replace all grades
export async function PUT(request: NextRequest) {
  const { grades } = await request.json();

  await prisma.gradeScale.deleteMany();
  const created = await prisma.gradeScale.createMany({
    data: grades.map((g: any, i: number) => ({
      name: g.name,
      minMarks: parseFloat(g.minMarks),
      maxMarks: parseFloat(g.maxMarks),
      gpa: g.gpa ? parseFloat(g.gpa) : null,
      remarks: g.remarks || null,
      order: i,
    })),
  });

  return Response.json({ message: 'Grade scale updated', count: created.count });
}
