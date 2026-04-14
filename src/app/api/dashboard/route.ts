import { prisma } from '@/lib/db';

export async function GET() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Current month in "YYYY-MM" format
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Two months ago for overdue calculation
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const overdueMonth = `${twoMonthsAgo.getFullYear()}-${String(twoMonthsAgo.getMonth() + 1).padStart(2, '0')}`;

  // First day of current month for attendance percentage calc
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  try {
    // ── Quick Stats (counts) ───────────────────────────────
    const [totalStudents, totalTeachers, totalClasses] = await Promise.all([
      prisma.student.count(),
      prisma.teacher.count(),
      prisma.class.count(),
    ]);

    // ── Today's Attendance ─────────────────────────────────
    const todayAttendance = await prisma.attendance.groupBy({
      by: ['status'],
      where: { date: todayStart },
      _count: { status: true },
    });

    const attendanceMap: Record<string, number> = {};
    for (const row of todayAttendance) {
      attendanceMap[row.status] = row._count.status;
    }

    const presentToday = attendanceMap['PRESENT'] || 0;
    const absentToday = attendanceMap['ABSENT'] || 0;
    const lateToday = attendanceMap['LATE'] || 0;
    const excusedToday = attendanceMap['EXCUSED'] || 0;
    const totalMarkedToday = presentToday + absentToday + lateToday + excusedToday;
    const attendancePct = totalMarkedToday > 0
      ? Math.round((presentToday / totalMarkedToday) * 100)
      : 0;

    // Classes that have NOT yet marked attendance today
    // 1. Get all sections (class + section combos)
    const allSections = await prisma.section.findMany({
      include: {
        class: { select: { name: true } },
        _count: { select: { students: true } },
      },
    });

    // 2. Get sections that HAVE attendance today (distinct by student's sectionId)
    const markedSectionIds = await prisma.attendance.findMany({
      where: { date: todayStart },
      select: { student: { select: { sectionId: true } } },
      distinct: ['studentId'],
    });
    const markedSectionSet = new Set(markedSectionIds.map(a => a.student.sectionId));

    const unmarkedClasses = allSections
      .filter(s => s._count.students > 0 && !markedSectionSet.has(s.id))
      .map(s => ({
        className: s.class.name,
        sectionName: s.name,
        studentCount: s._count.students,
      }));

    // ── Fee Collection This Month ──────────────────────────
    const monthDeposits = await prisma.feeLedger.aggregate({
      where: { month: currentMonth, type: 'DEPOSIT' },
      _sum: { amount: true },
      _count: { id: true },
    });
    const collectedThisMonth = monthDeposits._sum.amount || 0;

    // Total outstanding: sum of the latest balanceAfter per student (> 0 means owing)
    // Use raw query for efficiency: get each student's latest ledger entry
    const outstandingResult = await prisma.$queryRaw<{ total: number | null }[]>`
      SELECT SUM(sub."balanceAfter") as total
      FROM (
        SELECT DISTINCT ON ("studentId") "balanceAfter"
        FROM "fee_ledger"
        ORDER BY "studentId", "date" DESC, "createdAt" DESC
      ) sub
      WHERE sub."balanceAfter" > 0
    `;
    const totalOutstanding = outstandingResult[0]?.total || 0;

    // Top 5 recent deposits with student name
    const recentDeposits = await prisma.feeLedger.findMany({
      where: { type: 'DEPOSIT' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            class: { select: { name: true } },
          },
        },
      },
    });

    const recentDepositsFormatted = recentDeposits.map(d => ({
      id: d.id,
      studentName: `${d.student.user.firstName} ${d.student.user.lastName}`,
      className: d.student.class.name,
      amount: d.amount,
      method: d.paymentMethod,
      date: d.date,
      receiptNumber: d.receiptNumber,
    }));

    // ── Alerts: Low attendance this month (<75%) ───────────
    // Get all attendance records this month, group by student
    const monthAttendance = await prisma.attendance.groupBy({
      by: ['studentId', 'status'],
      where: {
        date: { gte: monthStart, lte: todayStart },
      },
      _count: { status: true },
    });

    // Build per-student totals
    const studentAttMap: Record<string, { total: number; present: number }> = {};
    for (const row of monthAttendance) {
      if (!studentAttMap[row.studentId]) {
        studentAttMap[row.studentId] = { total: 0, present: 0 };
      }
      studentAttMap[row.studentId].total += row._count.status;
      if (row.status === 'PRESENT' || row.status === 'LATE') {
        studentAttMap[row.studentId].present += row._count.status;
      }
    }

    const lowAttendanceStudentIds = Object.entries(studentAttMap)
      .filter(([, val]) => val.total >= 5 && (val.present / val.total) * 100 < 75)
      .map(([id]) => id);

    const lowAttendanceCount = lowAttendanceStudentIds.length;

    // Get names for top low-attendance students (max 10)
    let lowAttendanceStudents: { studentName: string; className: string; pct: number }[] = [];
    if (lowAttendanceStudentIds.length > 0) {
      const students = await prisma.student.findMany({
        where: { id: { in: lowAttendanceStudentIds.slice(0, 10) } },
        include: {
          user: { select: { firstName: true, lastName: true } },
          class: { select: { name: true } },
        },
      });
      lowAttendanceStudents = students.map(s => {
        const att = studentAttMap[s.id];
        return {
          studentName: `${s.user.firstName} ${s.user.lastName}`,
          className: s.class.name,
          pct: Math.round((att.present / att.total) * 100),
        };
      }).sort((a, b) => a.pct - b.pct);
    }

    // ── Alerts: Overdue fees (balance > 0 from 2+ months ago) ──
    const overdueStudentsRaw = await prisma.$queryRaw<{ studentId: string }[]>`
      SELECT DISTINCT "studentId"
      FROM "fee_ledger" fl1
      WHERE fl1."type" = 'CHARGE'
        AND fl1."month" <= ${overdueMonth}
        AND (
          SELECT fl2."balanceAfter"
          FROM "fee_ledger" fl2
          WHERE fl2."studentId" = fl1."studentId"
          ORDER BY fl2."date" DESC, fl2."createdAt" DESC
          LIMIT 1
        ) > 0
    `;
    const overdueCount = overdueStudentsRaw.length;

    // Get details for top 10 overdue students
    let overdueStudents: { studentName: string; className: string; balance: number }[] = [];
    if (overdueStudentsRaw.length > 0) {
      const overdueIds = overdueStudentsRaw.slice(0, 10).map(r => r.studentId);
      const students = await prisma.student.findMany({
        where: { id: { in: overdueIds } },
        include: {
          user: { select: { firstName: true, lastName: true } },
          class: { select: { name: true } },
          feeLedger: {
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
            take: 1,
            select: { balanceAfter: true },
          },
        },
      });
      overdueStudents = students
        .map(s => ({
          studentName: `${s.user.firstName} ${s.user.lastName}`,
          className: s.class.name,
          balance: s.feeLedger[0]?.balanceAfter || 0,
        }))
        .filter(s => s.balance > 0)
        .sort((a, b) => b.balance - a.balance);
    }

    return Response.json({
      quickStats: {
        totalStudents,
        totalTeachers,
        totalClasses,
        lowAttendanceCount,
        overdueCount,
      },
      attendance: {
        totalStudents,
        totalMarkedToday,
        presentToday,
        absentToday,
        lateToday,
        excusedToday,
        attendancePct,
        unmarkedClasses,
      },
      fees: {
        collectedThisMonth,
        totalOutstanding,
        depositCount: monthDeposits._count.id,
        recentDeposits: recentDepositsFormatted,
      },
      alerts: {
        lowAttendanceCount,
        lowAttendanceStudents,
        overdueCount,
        overdueStudents,
      },
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return Response.json({ error: 'Failed to load dashboard data' }, { status: 500 });
  }
}
