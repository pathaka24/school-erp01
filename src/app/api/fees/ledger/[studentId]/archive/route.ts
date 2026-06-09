import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { archiveStudentLedger, restoreStudentLedger } from '@/lib/feeLedger';
import { requireScope } from '@/lib/apiAuth';

// POST /api/fees/ledger/[studentId]/archive
// Soft-archive (void) ALL of a student's fee ledger entries. Recoverable.
// Body (optional): { reason?: string, actor?: string }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const { studentId } = await params;
  const body = await request.json().catch(() => ({}));

  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true } });
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });

  const result = await archiveStudentLedger(studentId, {
    actor: body.actor || auth.userId,
    reason: body.reason,
  });
  return Response.json(result);
}

// DELETE /api/fees/ledger/[studentId]/archive
// Restore a previously archived ledger (un-void the archive-tagged entries).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const { studentId } = await params;
  const result = await restoreStudentLedger(studentId, { actor: auth.userId });
  return Response.json(result);
}
