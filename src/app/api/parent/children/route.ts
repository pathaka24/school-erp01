import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/parent/children?userId=xxx
// Returns all children linked to the parent, with attendance summary and fee balance
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const userId = searchParams.get('userId');

  if (!userId) {
    return Response.json({ error: 'userId query param is required' }, { status: 400 });
  }

  // Find parent record by userId
  const parent = await prisma.parent.findUnique({
    where: { userId },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  });

  if (!parent) {
    return Response.json({ error: 'Parent not found for this user' }, { status: 404 });
  }

  // Find students directly linked via parentId
  let students = await prisma.student.findMany({
    where: { parentId: parent.id },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      family: { select: { id: true, name: true, familyId: true } },
    },
  });

  // Also find students in the same family as any of the parent's direct children
  const familyIds = students
    .map(s => s.familyId)
    .filter((id): id is string => id !== null);

  if (familyIds.length > 0) {
    const familyStudents = await prisma.student.findMany({
      where: {
        familyId: { in: familyIds },
        id: { notIn: students.map(s => s.id) },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        family: { select: { id: true, name: true, familyId: true } },
      },
    });
    students = [...students, ...familyStudents];
  }

  // Get attendance summary and fee balance for each student
  const enriched = await Promise.all(
    students.map(async (student) => {
      // Current academic year attendance (April to March)
      const now = new Date();
      const acadYearStart = now.getMonth() >= 3
        ? new Date(now.getFullYear(), 3, 1)      // April this year
        : new Date(now.getFullYear() - 1, 3, 1); // April last year

      const attendance = await prisma.attendance.findMany({
        where: {
          studentId: student.id,
          date: { gte: acadYearStart, lte: now },
        },
      });

      const totalDays = attendance.length;
      const presentDays = attendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
      const attendancePct = totalDays > 0 ? Number(((presentDays / totalDays) * 100).toFixed(1)) : 0;

      // Fee balance from ledger — last entry's balanceAfter
      const lastLedger = await prisma.feeLedger.findFirst({
        where: { studentId: student.id },
        orderBy: { createdAt: 'desc' },
      });
      const feeBalance = lastLedger?.balanceAfter ?? 0;

      return {
        id: student.id,
        userId: student.user.id,
        name: `${student.user.firstName} ${student.user.lastName}`,
        email: student.user.email,
        admissionNo: student.admissionNo,
        className: student.class.name,
        sectionName: student.section.name,
        classId: student.class.id,
        sectionId: student.section.id,
        familyName: student.family?.name || null,
        attendancePct,
        totalDays,
        presentDays,
        feeBalance,
      };
    })
  );

  return Response.json({
    parent: {
      id: parent.id,
      name: `${parent.user.firstName} ${parent.user.lastName}`,
      email: parent.user.email,
    },
    children: enriched,
  });
}
