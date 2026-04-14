import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const classId = searchParams.get('classId');
  const month = searchParams.get('month');
  const year = searchParams.get('year');

  if (!classId || !month || !year) {
    return Response.json(
      { error: 'classId, month, and year are required' },
      { status: 400 }
    );
  }

  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);

  // Build date range for the month
  const startDate = new Date(yearNum, monthNum - 1, 1);
  const endDate = new Date(yearNum, monthNum, 0); // last day of month

  const attendance = await prisma.attendance.findMany({
    where: {
      student: { classId },
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      student: {
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: [
      { student: { user: { firstName: 'asc' } } },
      { date: 'asc' },
    ],
  });

  // Build CSV
  const headers = ['Student Name', 'Admission No', 'Date', 'Status'];

  const rows = attendance.map((a) => [
    `${a.student.user.firstName} ${a.student.user.lastName}`,
    a.student.admissionNo,
    a.date.toISOString().split('T')[0],
    a.status,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  return new Response(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="attendance.csv"',
    },
  });
}
