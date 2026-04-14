import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/teacher-attendance?date=2026-04-04
export async function GET(request: NextRequest) {
  const dateParam = request.nextUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const month = request.nextUrl.searchParams.get('month'); // "2026-04" for monthly view

  const teachers = await prisma.teacher.findMany({
    include: { user: { select: { firstName: true, lastName: true, phone: true } } },
    orderBy: { user: { firstName: 'asc' } },
  });

  if (month) {
    // Monthly view
    const [y, m] = month.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 1));
    const records = await (prisma as any).teacherAttendance.findMany({
      where: { date: { gte: start, lt: end } },
      orderBy: { date: 'asc' },
    });

    // Group by teacher
    const byTeacher = new Map<string, any[]>();
    for (const r of records) {
      if (!byTeacher.has(r.teacherId)) byTeacher.set(r.teacherId, []);
      byTeacher.get(r.teacherId)!.push(r);
    }

    const data = teachers.map(t => {
      const recs = byTeacher.get(t.id) || [];
      const present = recs.filter((r: any) => r.status === 'PRESENT' || r.status === 'LATE').length;
      const absent = recs.filter((r: any) => r.status === 'ABSENT').length;
      const late = recs.filter((r: any) => r.status === 'LATE').length;
      return {
        id: t.id,
        employeeId: t.employeeId,
        name: `${t.user.firstName} ${t.user.lastName}`.trim(),
        phone: t.user.phone,
        records: recs,
        summary: { total: recs.length, present, absent, late, pct: recs.length > 0 ? Math.round((present / recs.length) * 100) : 0 },
      };
    });

    return Response.json({ month, teachers: data });
  }

  // Daily view
  const date = new Date(dateParam);
  date.setHours(0, 0, 0, 0);
  const records = await (prisma as any).teacherAttendance.findMany({
    where: { date },
  });
  const attMap = new Map(records.map((r: any) => [r.teacherId, r]));

  const data = teachers.map(t => ({
    id: t.id,
    employeeId: t.employeeId,
    name: `${t.user.firstName} ${t.user.lastName}`.trim(),
    phone: t.user.phone,
    attendance: attMap.get(t.id) || null,
  }));

  const present = records.filter((r: any) => r.status === 'PRESENT' || r.status === 'LATE').length;
  const absent = records.filter((r: any) => r.status === 'ABSENT').length;

  return Response.json({
    date: dateParam,
    totalTeachers: teachers.length,
    marked: records.length,
    present, absent,
    teachers: data,
  });
}

// POST /api/teacher-attendance — bulk mark
export async function POST(request: NextRequest) {
  const { date, records } = await request.json() as {
    date: string;
    records: { teacherId: string; status: string; checkIn?: string; checkOut?: string; remarks?: string }[];
  };

  if (!date || !records?.length) {
    return Response.json({ error: 'date and records required' }, { status: 400 });
  }

  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  let saved = 0;
  for (const r of records) {
    if (!['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].includes(r.status)) continue;
    await (prisma as any).teacherAttendance.upsert({
      where: { teacherId_date: { teacherId: r.teacherId, date: d } },
      create: { teacherId: r.teacherId, date: d, status: r.status, checkIn: r.checkIn || null, checkOut: r.checkOut || null, remarks: r.remarks || null },
      update: { status: r.status, checkIn: r.checkIn || null, checkOut: r.checkOut || null, remarks: r.remarks || null },
    });
    saved++;
  }

  return Response.json({ saved, total: records.length, date });
}
