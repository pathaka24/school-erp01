import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { displayName, maxMarks, passingPct, weightage, category, isActive, order } = body;

  try {
    const pattern = await prisma.examPattern.update({
      where: { id },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(maxMarks !== undefined && { maxMarks: parseInt(maxMarks) }),
        ...(passingPct !== undefined && { passingPct: parseFloat(passingPct) }),
        ...(weightage !== undefined && { weightage: parseFloat(weightage) }),
        ...(category !== undefined && { category }),
        ...(isActive !== undefined && { isActive }),
        ...(order !== undefined && { order }),
      },
    });
    return Response.json(pattern);
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.examPattern.delete({ where: { id } });
    return Response.json({ message: 'Deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
