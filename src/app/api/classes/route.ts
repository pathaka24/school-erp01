import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const classes = await prisma.class.findMany({
    include: {
      sections: { include: { classTeacher: { include: { user: { select: { firstName: true, lastName: true } } } } } },
      _count: { select: { students: true } },
    },
    orderBy: { numericGrade: 'asc' },
  });
  return Response.json(classes);
}

export async function POST(request: NextRequest) {
  const { name, numericGrade, sections } = await request.json();
  try {
    const cls = await prisma.class.create({
      data: {
        name,
        numericGrade,
        sections: sections?.length
          ? { createMany: { data: sections.map((s: string) => ({ name: s })) } }
          : undefined,
      },
      include: { sections: true },
    });
    return Response.json(cls, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') return Response.json({ error: 'Class name already exists' }, { status: 409 });
    return Response.json({ error: 'Failed to create class' }, { status: 500 });
  }
}
