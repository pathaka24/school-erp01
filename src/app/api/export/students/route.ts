import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const classId = searchParams.get('classId');

  const where: any = {};
  if (classId) where.classId = classId;

  const students = await prisma.student.findMany({
    where,
    include: {
      user: { select: { firstName: true, lastName: true } },
      class: { select: { name: true } },
      section: { select: { name: true } },
    },
    orderBy: { user: { firstName: 'asc' } },
  });

  // Build CSV
  const headers = [
    'Admission No',
    'Name',
    'Class',
    'Section',
    'Gender',
    'DOB',
    'Father Name',
    'Father Phone',
    'Mother Name',
    'Address',
    'City',
  ];

  const rows = students.map((s) => [
    s.admissionNo,
    `${s.user.firstName} ${s.user.lastName}`,
    s.class.name,
    s.section.name,
    s.gender,
    s.dateOfBirth.toISOString().split('T')[0],
    s.fatherName || '',
    s.fatherPhone || '',
    s.motherName || '',
    s.currentAddress || '',
    s.currentCity || '',
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
      'Content-Disposition': 'attachment; filename="students.csv"',
    },
  });
}
