import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireScope } from '@/lib/apiAuth';
import { archiveStudentLedger } from '@/lib/feeLedger';

// POST /api/students/bulk-delete
// Body: { studentIds: string[], archiveFees?: boolean }
// Soft-deletes the matching students by deactivating their User records.
// With archiveFees:true, also soft-archives (voids) each student's fee ledger.
// Mirrors what DELETE /api/students/[id] does, just in bulk.
export async function POST(request: NextRequest) {
  const auth = await requireScope(request, 'students');
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const { studentIds, archiveFees, permanent } = body;
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return Response.json({ error: 'studentIds[] is required' }, { status: 400 });
  }

  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, userId: true, user: { select: { firstName: true, lastName: true, isActive: true } } },
  });
  if (students.length === 0) {
    return Response.json({ error: 'No matching students found' }, { status: 404 });
  }

  // Permanent (hard) delete — ADMIN only, and only students already marked left.
  // Deleting the User cascades to the Student and all their required records.
  if (permanent) {
    if (auth.role !== 'ADMIN') {
      return Response.json({ error: 'Permanent delete requires an admin' }, { status: 403 });
    }
    const inactive = students.filter(s => !s.user.isActive);
    const skippedActive = students.length - inactive.length;
    let deleted = 0;
    const failed: string[] = [];
    for (const s of inactive) {
      try { await prisma.user.delete({ where: { id: s.userId } }); deleted++; }
      catch { failed.push(s.id); }
    }
    return Response.json({ deleted, skippedActive, failed: failed.length });
  }

  const userIds = students.map(s => s.userId);
  const now = new Date();

  let feesArchived = 0;
  if (archiveFees) {
    for (const s of students) {
      const result = await archiveStudentLedger(s.id, { actor: auth.userId, reason: 'Student deleted (bulk)' });
      feesArchived += result.archived;
    }
  }

  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { isActive: false, deletedAt: now, deletedBy: auth.userId } as any,
  });

  return Response.json({
    deactivated: students.length,
    feesArchived,
    names: students.slice(0, 10).map(s => `${s.user.firstName} ${s.user.lastName}`.trim()),
  });
}
