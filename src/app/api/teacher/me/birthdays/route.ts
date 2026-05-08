import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/teacher/me/birthdays?userId=&days=7
// Returns students in this teacher's class-teacher sections whose birthday
// falls within the next N days (default 7), starting from today.
//
// Birthdays match by month + day (year is ignored).
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const userId = sp.get('userId');
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 });

  const days = Math.min(60, Math.max(1, parseInt(sp.get('days') || '7', 10)));

  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    include: {
      classSections: {
        include: {
          class: { select: { id: true, name: true } },
          students: {
            where: { user: { isActive: true } },
            include: { user: { select: { firstName: true, lastName: true } } },
          },
        },
      },
    },
  });
  if (!teacher) return Response.json({ error: 'Teacher not found' }, { status: 404 });

  const allStudents = teacher.classSections.flatMap(s =>
    s.students.map(st => ({ ...st, sectionName: s.name, className: s.class.name })),
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();

  // For each student, compute days-until-next-birthday
  const upcoming = allStudents
    .filter(s => s.dateOfBirth)
    .map(s => {
      const dob = new Date(s.dateOfBirth!);
      const m = dob.getMonth();
      const d = dob.getDate();
      // Next birthday: this year, or next year if already passed
      let next = new Date(today.getFullYear(), m, d);
      if (next < today) next = new Date(today.getFullYear() + 1, m, d);
      const diffDays = Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const turning = next.getFullYear() - dob.getFullYear();
      return {
        studentId: s.id,
        name: `${s.user.firstName} ${s.user.lastName}`.trim(),
        admissionNo: s.admissionNo,
        rollNumber: s.rollNumber,
        class: s.className,
        section: s.sectionName,
        dob: s.dateOfBirth,
        birthdayDate: next.toISOString().slice(0, 10),
        daysUntil: diffDays,
        turning,
        isToday: diffDays === 0,
      };
    })
    .filter(s => s.daysUntil <= days)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return Response.json({
    teacher: { id: teacher.id },
    days,
    sections: teacher.classSections.map(s => `${s.class.name} · ${s.name}`),
    todayCount: upcoming.filter(s => s.isToday).length,
    students: upcoming,
  });
}
