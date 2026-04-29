import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// PUT /api/library/issues/[id]
// Body: { action: 'RETURN' | 'LOST', fineAmount?, remarks? }
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { action, fineAmount, remarks } = await request.json();

  const data: any = {};
  if (action === 'RETURN') {
    data.status = 'RETURNED';
    data.returnedDate = new Date();
  } else if (action === 'LOST') {
    data.status = 'LOST';
  }
  if (fineAmount !== undefined) data.fineAmount = Number(fineAmount);
  if (remarks !== undefined) data.remarks = remarks || null;

  try {
    const issue = await prisma.bookIssue.update({ where: { id }, data });
    return Response.json(issue);
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Issue not found' }, { status: 404 });
    return Response.json({ error: 'Failed to update issue' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.bookIssue.delete({ where: { id } });
    return Response.json({ message: 'Issue record deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Issue not found' }, { status: 404 });
    return Response.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
