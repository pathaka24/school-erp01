import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET — Quick teacher lookup for QR scan
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: {
      user: { select: { firstName: true, lastName: true, phone: true } },
      subjects: { select: { name: true } },
      classSections: { include: { class: { select: { name: true } } } },
    },
  });
  if (!teacher) return Response.json({ error: 'Teacher not found' }, { status: 404 });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayAtt = await (prisma as any).teacherAttendance.findUnique({
    where: { teacherId_date: { teacherId: id, date: today } },
  });

  // Month summary
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const monthAtt = await (prisma as any).teacherAttendance.findMany({
    where: { teacherId: id, date: { gte: monthStart, lt: monthEnd } },
    select: { status: true },
  });
  const total = monthAtt.length;
  const present = monthAtt.filter((a: any) => a.status === 'PRESENT' || a.status === 'LATE').length;

  return Response.json({
    teacher: {
      id: teacher.id,
      name: `${teacher.user.firstName} ${teacher.user.lastName}`,
      employeeId: teacher.employeeId,
      phone: teacher.user.phone,
      photo: (teacher as any).photo,
      designation: (teacher as any).designation,
      subjects: teacher.subjects.map((s: any) => s.name),
      classSections: teacher.classSections.map((s: any) => `${s.class.name}-${s.name}`),
    },
    todayAttendance: todayAtt ? { status: todayAtt.status, checkIn: todayAtt.checkIn, checkOut: todayAtt.checkOut } : null,
    monthAttendance: { total, present, pct: total > 0 ? Math.round((present / total) * 100) : 0 },
  });
}

// POST — Mark teacher attendance via QR
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { status, checkIn, checkOut, remarks } = await req.json();
  if (!status || !['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].includes(status)) {
    return Response.json({ error: 'Invalid status' }, { status: 400 });
  }

  const teacher = await prisma.teacher.findUnique({ where: { id }, select: { id: true } });
  if (!teacher) return Response.json({ error: 'Teacher not found' }, { status: 404 });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const att = await (prisma as any).teacherAttendance.upsert({
    where: { teacherId_date: { teacherId: id, date: today } },
    create: { teacherId: id, date: today, status, checkIn: checkIn || null, checkOut: checkOut || null, remarks: remarks || null },
    update: { status, ...(checkIn ? { checkIn } : {}), ...(checkOut ? { checkOut } : {}), remarks: remarks || null },
  });

  return Response.json({ attendance: att, message: `Marked ${status}` });
}
