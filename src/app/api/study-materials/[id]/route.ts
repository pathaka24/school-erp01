import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.studyMaterial.delete({ where: { id } });
    return Response.json({ message: 'Material deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Material not found' }, { status: 404 });
    return Response.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
