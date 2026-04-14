import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const studentId = searchParams.get('studentId');
  const classId = searchParams.get('classId');

  if (!studentId && !classId) {
    return Response.json(
      { error: 'studentId or classId is required' },
      { status: 400 }
    );
  }

  // Determine which students to export
  let studentIds: string[] = [];
  if (studentId) {
    studentIds = [studentId];
  } else if (classId) {
    const students = await prisma.student.findMany({
      where: { classId },
      select: { id: true },
    });
    studentIds = students.map((s) => s.id);
  }

  if (studentIds.length === 0) {
    return new Response('No students found', { status: 404 });
  }

  const entries = await prisma.feeLedger.findMany({
    where: { studentId: { in: studentIds } },
    include: {
      student: {
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });

  // Build CSV
  const headers = [
    'Student Name',
    'Admission No',
    'Month',
    'Type',
    'Category',
    'Description',
    'Amount',
    'Balance',
    'Payment Method',
    'Receipt',
    'Date',
  ];

  const rows = entries.map((e) => [
    `${e.student.user.firstName} ${e.student.user.lastName}`,
    e.student.admissionNo,
    e.month,
    e.type,
    e.category || '',
    e.description,
    e.amount.toString(),
    e.balanceAfter.toString(),
    e.paymentMethod || '',
    e.receiptNumber || '',
    e.date.toISOString().split('T')[0],
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
      'Content-Disposition': 'attachment; filename="fee-ledger.csv"',
    },
  });
}
