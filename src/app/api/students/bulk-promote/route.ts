import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireScope } from '@/lib/apiAuth';

// POST /api/students/bulk-promote
// Body: {
//   studentIds: string[],
//   targetClassId: string,        // any class — caller can pick non-sequential to "jump" or repeat
//   targetSectionId: string,
//   year: string,                 // academic year being closed, e.g. "2025-2026"
//   result: 'PROMOTED' | 'DETAINED' | 'TRANSFERRED',
//   carryBalance?: boolean,       // default true — copy outstanding fee balance into next year
//   remarks?: string,
// }
// For each student:
//   1. Updates classId + sectionId on Student
//   2. Writes a PromotionHistory row (year, fromGrade, toGrade, result)
//   3. If carryBalance true and student owes money, posts a PREVIOUS_BALANCE
//      charge under the target class for the first month of the new year.
export async function POST(request: NextRequest) {
  const auth = await requireScope(request, 'students');
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const { studentIds, targetClassId, targetSectionId, year, result, carryBalance = true, remarks } = body;

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return Response.json({ error: 'studentIds[] is required' }, { status: 400 });
  }
  if (!targetClassId || !targetSectionId) {
    return Response.json({ error: 'targetClassId and targetSectionId are required' }, { status: 400 });
  }
  if (!year || !/^\d{4}-\d{4}$/.test(year)) {
    return Response.json({ error: 'year must be like "2025-2026"' }, { status: 400 });
  }
  if (!['PROMOTED', 'DETAINED', 'TRANSFERRED'].includes(result)) {
    return Response.json({ error: 'result must be PROMOTED / DETAINED / TRANSFERRED' }, { status: 400 });
  }

  // Validate target
  const targetClass = await prisma.class.findUnique({
    where: { id: targetClassId },
    include: { sections: true },
  });
  if (!targetClass) return Response.json({ error: 'Target class not found' }, { status: 404 });
  const targetSection = targetClass.sections.find(s => s.id === targetSectionId);
  if (!targetSection) return Response.json({ error: 'Target section not in target class' }, { status: 400 });

  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    include: { class: true, user: { select: { firstName: true, lastName: true } } },
  });

  if (students.length === 0) {
    return Response.json({ error: 'No matching students' }, { status: 404 });
  }

  // Derive first month of the new academic year (e.g. "2025-2026" -> next is "2026-04")
  // For DETAINED, fees still carry forward; toYear's first month is `${parseYear+1}-04`
  const newYearStart = year.split('-')[1]; // "2026"
  const firstMonth = `${newYearStart}-04`;
  const monthDate = new Date(`${firstMonth}-01T00:00:00Z`);

  let processed = 0;
  let totalBalanceCarried = 0;
  const errors: { studentId: string; reason: string }[] = [];

  for (const student of students) {
    try {
      // 1. Move student (only if PROMOTED — DETAINED stays in same class but we still log it)
      if (result === 'PROMOTED' || result === 'TRANSFERRED') {
        await prisma.student.update({
          where: { id: student.id },
          data: { classId: targetClassId, sectionId: targetSectionId },
        });
      }

      // 2. Promotion history
      await prisma.promotionHistory.create({
        data: {
          studentId: student.id,
          year,
          fromGrade: student.class.name,
          toGrade: result === 'DETAINED' ? student.class.name : targetClass.name,
          result: result as any,
          remarks: remarks || null,
        },
      });

      // 3. Carry forward outstanding fee balance
      if (carryBalance) {
        const lastEntry = await prisma.feeLedger.findFirst({
          where: { studentId: student.id, voidedAt: null } as any,
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          select: { balanceAfter: true },
        });
        const balance = lastEntry?.balanceAfter ?? 0;
        if (balance > 0) {
          await prisma.feeLedger.create({
            data: {
              studentId: student.id,
              month: firstMonth,
              type: 'CHARGE',
              category: 'PREVIOUS_BALANCE',
              description: `Previous Balance Carried Forward (${year})`,
              amount: balance,
              balanceAfter: balance,
              date: monthDate,
            },
          });
          totalBalanceCarried += balance;
        }
      }

      processed++;
    } catch (err: any) {
      errors.push({ studentId: student.id, reason: err?.message || 'unknown error' });
    }
  }

  return Response.json({
    processed,
    totalBalanceCarried,
    targetClass: targetClass.name,
    targetSection: targetSection.name,
    result,
    errors: errors.length ? errors : undefined,
  });
}
