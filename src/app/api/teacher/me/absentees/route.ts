import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/teacher/me/absentees?userId=&from=&to=&threshold=75
// Returns students in this teacher's class-teacher sections whose attendance %
// for the given date range falls below the threshold.
//
// Defaults: from = first of current month, to = today, threshold = 75
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const userId = sp.get('userId');
  if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 });

  const threshold = parseFloat(sp.get('threshold') || '75');
  const today = new Date();
  const fromStr = sp.get('from') || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const toStr = sp.get('to') || today.toISOString().slice(0, 10);
  const fromDate = new Date(fromStr + 'T00:00:00Z');
  const toDate = new Date(toStr + 'T23:59:59Z');

  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    include: {
      classSections: {
        include: {
          class: { select: { id: true, name: true } },
          students: {
            where: { user: { isActive: true } },
            include: { user: { select: { firstName: true, lastName: true, phone: true } } },
          },
        },
      },
    },
  });
  if (!teacher) return Response.json({ error: 'Teacher not found' }, { status: 404 });

  const sectionStudents = teacher.classSections.flatMap(s =>
    s.students.map(st => ({ ...st, sectionName: s.name, className: s.class.name })),
  );

  if (sectionStudents.length === 0) {
    return Response.json({
      teacher: { id: teacher.id },
      range: { from: fromStr, to: toStr },
      threshold,
      sections: teacher.classSections.map(s => `${s.class.name} · ${s.name}`),
      students: [],
      message: 'You are not assigned as class teacher to any section.',
    });
  }

  const studentIds = sectionStudents.map(s => s.id);

  // Pull attendance for the date range
  const records = await prisma.attendance.findMany({
    where: {
      studentId: { in: studentIds },
      date: { gte: fromDate, lte: toDate },
    },
  });

  // Aggregate per-student: present / absent / total
  const stats = new Map<string, { present: number; absent: number; late: number; excused: number; total: number }>();
  for (const sid of studentIds) stats.set(sid, { present: 0, absent: 0, late: 0, excused: 0, total: 0 });

  for (const r of records) {
    const s = stats.get(r.studentId);
    if (!s) continue;
    s.total++;
    if (r.status === 'PRESENT') s.present++;
    else if (r.status === 'ABSENT') s.absent++;
    else if (r.status === 'LATE') { s.late++; s.present++; } // count late as half-present? counted as present here
    else if (r.status === 'EXCUSED') s.excused++;
  }

  // Compute pct & filter below threshold (only if they have at least 1 record;
  // students with 0 records shouldn't be flagged — they may be new admissions)
  const flagged = sectionStudents.map(s => {
    const st = stats.get(s.id)!;
    const denom = st.total - st.excused; // exclude excused from denominator
    const pct = denom > 0 ? (st.present / denom) * 100 : null;
    return {
      studentId: s.id,
      name: `${s.user.firstName} ${s.user.lastName}`.trim(),
      admissionNo: s.admissionNo,
      rollNumber: s.rollNumber,
      class: s.className,
      section: s.sectionName,
      phone: s.user.phone,
      fatherPhone: s.fatherPhone,
      motherPhone: s.motherPhone,
      ...st,
      pct,
    };
  })
    .filter(s => s.pct !== null && s.pct < threshold)
    .sort((a, b) => (a.pct ?? 100) - (b.pct ?? 100));

  return Response.json({
    teacher: { id: teacher.id },
    range: { from: fromStr, to: toStr },
    threshold,
    sections: teacher.classSections.map(s => `${s.class.name} · ${s.name}`),
    totalStudents: sectionStudents.length,
    flaggedCount: flagged.length,
    students: flagged,
  });
}
