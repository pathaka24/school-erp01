import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { restoreStudentLedger } from '@/lib/feeLedger';
import { requireScope } from '@/lib/apiAuth';

// POST /api/students/[id]/restore — re-admit a left (soft-deleted) student.
// Reactivates the user account and clears the leaving metadata.
// Body: { restoreFees?: boolean } — also un-archive fee records that were
// archived when the student left (manually voided entries stay voided).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireScope(request, 'students');
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const student = await prisma.student.findUnique({
    where: { id },
    include: { user: { select: { id: true, isActive: true } } },
  });
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });
  if (student.user.isActive) return Response.json({ error: 'Student is already active' }, { status: 400 });

  await prisma.user.update({
    where: { id: student.userId },
    data: { isActive: true, deletedAt: null, deletedBy: null },
  });
  await prisma.student.update({ where: { id }, data: { leftReason: null, tcNumber: null } });

  let feesRestored = 0;
  if (body.restoreFees) {
    const result = await restoreStudentLedger(id, { actor: `${auth.userId}` });
    feesRestored = result.restored;
  }

  return Response.json({ message: 'Student re-admitted', feesRestored });
}
