import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/students/[id]/qr-scan — Quick student lookup for QR scan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      user: { select: { firstName: true, lastName: true, phone: true } },
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  });

  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });

  // Today's attendance
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayAttendance = await prisma.attendance.findUnique({
    where: { studentId_date: { studentId: id, date: today } },
  });

  // Fee balance (latest ledger entry)
  const lastLedger = await prisma.feeLedger.findFirst({
    where: { studentId: id },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    select: { balanceAfter: true },
  });

  // Attendance summary this month
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const monthAttendance = await prisma.attendance.findMany({
    where: { studentId: id, date: { gte: monthStart, lt: monthEnd } },
    select: { status: true },
  });
  const totalDays = monthAttendance.length;
  const presentDays = monthAttendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;

  return Response.json({
    student: {
      id: student.id,
      name: `${student.user.firstName} ${student.user.lastName}`,
      admissionNo: student.admissionNo,
      class: student.class?.name,
      classId: student.class?.id,
      section: student.section?.name,
      sectionId: student.section?.id,
      phone: student.user.phone,
      photo: student.photo,
      fatherName: student.fatherName,
    },
    todayAttendance: todayAttendance ? { status: todayAttendance.status, remarks: todayAttendance.remarks } : null,
    feeBalance: lastLedger?.balanceAfter ?? 0,
    monthAttendance: { total: totalDays, present: presentDays, pct: totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0 },
  });
}

// POST /api/students/[id]/qr-scan — Quick mark attendance via QR
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { status, remarks } = body;

  if (!status || !['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].includes(status)) {
    return Response.json({ error: 'Invalid status' }, { status: 400 });
  }

  const student = await prisma.student.findUnique({ where: { id }, select: { id: true } });
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const attendance = await prisma.attendance.upsert({
    where: { studentId_date: { studentId: id, date: today } },
    create: { studentId: id, date: today, status, remarks: remarks || null },
    update: { status, remarks: remarks || null },
  });

  return Response.json({ attendance, message: `Marked ${status} for today` });
}
