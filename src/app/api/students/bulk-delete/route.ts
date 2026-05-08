import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireScope } from '@/lib/apiAuth';

// POST /api/students/bulk-delete
// Body: { studentIds: string[] }
// Soft-deletes the matching students by deactivating their User records.
// Mirrors what DELETE /api/students/[id] does, just in bulk and inside a transaction.
export async function POST(request: NextRequest) {
  const auth = await requireScope(request, 'students');
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const { studentIds } = body;
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return Response.json({ error: 'studentIds[] is required' }, { status: 400 });
  }
  if (studentIds.length > 500) {
    return Response.json({ error: 'Too many at once. Limit 500 per call.' }, { status: 400 });
  }

  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, userId: true, user: { select: { firstName: true, lastName: true } } },
  });
  if (students.length === 0) {
    return Response.json({ error: 'No matching students found' }, { status: 404 });
  }

  const userIds = students.map(s => s.userId);
  const now = new Date();

  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { isActive: false, deletedAt: now, deletedBy: auth.userId } as any,
  });

  return Response.json({
    deactivated: students.length,
    names: students.slice(0, 10).map(s => `${s.user.firstName} ${s.user.lastName}`.trim()),
  });
}
