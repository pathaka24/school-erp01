import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  const dateParam = request.nextUrl.searchParams.get('date');
  if (!userId) {
    return Response.json({ error: 'userId is required' }, { status: 400 });
  }

  const today = dateParam ? new Date(dateParam) : new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = DAYS[today.getDay()];

  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      subjects: { select: { id: true } },
      classSections: {
        include: {
          class: { select: { id: true, name: true } },
          students: { select: { id: true } },
        },
      },
    },
  });

  if (!teacher) {
    return Response.json({ error: 'Teacher not found' }, { status: 404 });
  }

  const periodsRaw = await prisma.timetable.findMany({
    where: { teacherId: teacher.id, dayOfWeek: dayOfWeek as any },
    include: {
      class: { select: { id: true, name: true } },
      section: {
        select: {
          id: true,
          name: true,
          students: { select: { id: true } },
        },
      },
      subject: { select: { id: true, name: true, code: true } },
    },
    orderBy: { startTime: 'asc' },
  });

  const sectionIds = Array.from(new Set(periodsRaw.map(p => p.sectionId)));
  const subjectIds = Array.from(new Set(periodsRaw.map(p => p.subjectId)));

  const [lessonPlansToday, attendanceToday] = await Promise.all([
    prisma.lessonPlan.findMany({
      where: {
        teacherId: teacher.id,
        date: today,
        sectionId: { in: sectionIds.length ? sectionIds : ['__none__'] },
        subjectId: { in: subjectIds.length ? subjectIds : ['__none__'] },
      },
      select: {
        id: true, sectionId: true, subjectId: true, status: true, topic: true, homework: true,
      },
    }),
    prisma.attendance.findMany({
      where: {
        date: today,
        student: { sectionId: { in: sectionIds.length ? sectionIds : ['__none__'] } },
      },
      select: { studentId: true, status: true, student: { select: { sectionId: true } } },
    }),
  ]);

  const planKey = (sectionId: string, subjectId: string) => `${sectionId}:${subjectId}`;
  const planMap = new Map(lessonPlansToday.map(p => [planKey(p.sectionId, p.subjectId), p]));

  const attendanceBySection = new Map<string, { present: number; absent: number; late: number; excused: number; total: number }>();
  for (const a of attendanceToday) {
    const sid = a.student.sectionId;
    if (!attendanceBySection.has(sid)) {
      attendanceBySection.set(sid, { present: 0, absent: 0, late: 0, excused: 0, total: 0 });
    }
    const bucket = attendanceBySection.get(sid)!;
    bucket.total += 1;
    if (a.status === 'PRESENT') bucket.present += 1;
    else if (a.status === 'ABSENT') bucket.absent += 1;
    else if (a.status === 'LATE') bucket.late += 1;
    else if (a.status === 'EXCUSED') bucket.excused += 1;
  }

  const periods = periodsRaw.map(p => {
    const totalStudents = p.section.students.length;
    const att = attendanceBySection.get(p.sectionId);
    const plan = planMap.get(planKey(p.sectionId, p.subjectId)) || null;
    return {
      id: p.id,
      classId: p.classId,
      className: p.class.name,
      sectionId: p.sectionId,
      sectionName: p.section.name,
      subjectId: p.subjectId,
      subjectName: p.subject.name,
      subjectCode: p.subject.code,
      startTime: p.startTime,
      endTime: p.endTime,
      room: p.room,
      totalStudents,
      attendanceMarked: !!att && att.total >= totalStudents && totalStudents > 0,
      attendanceSummary: att ? { ...att } : null,
      lessonPlan: plan,
    };
  });

  const classTeacherSections = teacher.classSections.map(s => {
    const att = attendanceBySection.get(s.id) || null;
    const total = s.students.length;
    return {
      sectionId: s.id,
      sectionName: s.name,
      className: s.class.name,
      classId: s.classId,
      totalStudents: total,
      attendanceMarked: !!att && att.total >= total && total > 0,
      attendanceSummary: att,
    };
  });

  const subjectIdsTaught = teacher.subjects.map(s => s.id);
  const recentExams = subjectIdsTaught.length
    ? await prisma.exam.findMany({
        where: {
          examSubjects: { some: { subjectId: { in: subjectIdsTaught } } },
          endDate: { gte: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000) },
        },
        include: {
          class: { select: { id: true, name: true, sections: { select: { students: { select: { id: true } } } } } },
          examSubjects: {
            where: { subjectId: { in: subjectIdsTaught } },
            include: {
              subject: { select: { id: true, name: true } },
              grades: { select: { studentId: true } },
            },
          },
        },
        orderBy: { endDate: 'desc' },
        take: 10,
      })
    : [];

  const pendingGrades = recentExams.flatMap(exam => {
    const classStudentCount = exam.class.sections.reduce((sum, sec) => sum + sec.students.length, 0);
    return exam.examSubjects
      .map(es => {
        const graded = es.grades.length;
        const missing = Math.max(0, classStudentCount - graded);
        if (missing === 0) return null;
        return {
          examId: exam.id,
          examName: exam.name,
          examType: exam.type,
          className: exam.class.name,
          subjectId: es.subject.id,
          subjectName: es.subject.name,
          examSubjectId: es.id,
          totalStudents: classStudentCount,
          gradedCount: graded,
          missingCount: missing,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  });

  return Response.json({
    date: today.toISOString().slice(0, 10),
    dayOfWeek,
    teacher: {
      id: teacher.id,
      employeeId: teacher.employeeId,
      firstName: teacher.user.firstName,
      lastName: teacher.user.lastName,
    },
    periods,
    classTeacherSections,
    pendingGrades,
    counts: {
      periods: periods.length,
      periodsWithPlan: periods.filter(p => p.lessonPlan).length,
      sectionsNeedingAttendance: classTeacherSections.filter(s => !s.attendanceMarked && s.totalStudents > 0).length,
      pendingGradeSubjects: pendingGrades.length,
    },
  });
}
