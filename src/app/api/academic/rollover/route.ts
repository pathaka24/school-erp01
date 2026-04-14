import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  // Preview: return per-class counts for rollover planning
  const classes = await prisma.class.findMany({
    orderBy: { numericGrade: 'asc' },
    include: {
      sections: { select: { id: true, name: true } },
      _count: { select: { students: true } },
    },
  });

  const preview = classes.map((c) => ({
    classId: c.id,
    className: c.name,
    numericGrade: c.numericGrade,
    studentCount: c._count.students,
    action: c.numericGrade >= 10 ? 'GRADUATE' : 'PROMOTE',
  }));

  return Response.json(preview);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { fromYear, toYear } = body as { fromYear: string; toYear: string };

  if (!fromYear || !toYear) {
    return Response.json(
      { error: 'fromYear and toYear are required' },
      { status: 400 }
    );
  }

  // Get all classes ordered by grade
  const classes = await prisma.class.findMany({
    orderBy: { numericGrade: 'asc' },
    include: { sections: true },
  });

  const classMap = new Map(classes.map((c) => [c.numericGrade, c]));

  // Get all students with their current class
  const students = await prisma.student.findMany({
    include: {
      class: true,
      user: { select: { firstName: true, lastName: true } },
    },
  });

  let promoted = 0;
  let graduated = 0;
  let totalBalanceCarried = 0;

  // Derive first month of new year from toYear (e.g. "2026-2027" -> "2026-04")
  const newYearStart = toYear.split('-')[0];
  const firstMonth = `${newYearStart}-04`;

  for (const student of students) {
    const currentGrade = student.class.numericGrade;

    // Class 10 or above: graduated, skip promotion
    if (currentGrade >= 10) {
      graduated++;
      await prisma.promotionHistory.create({
        data: {
          studentId: student.id,
          year: fromYear,
          fromGrade: student.class.name,
          toGrade: 'GRADUATED',
          result: 'PROMOTED',
        },
      });
      continue;
    }

    // Find next class
    const nextClass = classMap.get(currentGrade + 1);
    if (!nextClass) {
      // No next class defined; skip
      continue;
    }

    // Find Section A of next class (default)
    const sectionA = nextClass.sections.find(
      (s) => s.name.toUpperCase() === 'A'
    );
    if (!sectionA) {
      // No Section A in next class; use first available section
      if (nextClass.sections.length === 0) continue;
    }

    const targetSectionId = sectionA
      ? sectionA.id
      : nextClass.sections[0].id;

    // Update student's class and section
    await prisma.student.update({
      where: { id: student.id },
      data: {
        classId: nextClass.id,
        sectionId: targetSectionId,
      },
    });

    // Create promotion history
    await prisma.promotionHistory.create({
      data: {
        studentId: student.id,
        year: fromYear,
        fromGrade: student.class.name,
        toGrade: nextClass.name,
        result: 'PROMOTED',
      },
    });

    // Carry forward fee balance
    const lastEntry = await prisma.feeLedger.findFirst({
      where: { studentId: student.id },
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
          description: `Previous Balance Carried Forward (${fromYear})`,
          amount: balance,
          balanceAfter: balance,
          date: new Date(`${firstMonth}-01T00:00:00Z`),
        },
      });
      totalBalanceCarried += balance;
    }

    promoted++;
  }

  return Response.json({
    promoted,
    graduated,
    totalBalanceCarried,
  });
}
