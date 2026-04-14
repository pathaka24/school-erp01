import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, classTeacherId } = await request.json();
  try {
    const section = await prisma.section.create({ data: { name, classId: id, classTeacherId } });
    return Response.json(section, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') return Response.json({ error: 'Section already exists in this class' }, { status: 409 });
    return Response.json({ error: 'Failed to add section' }, { status: 500 });
  }
}
