import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, avatar: true } },
      class: true,
      section: true,
      parent: { include: { user: { select: { firstName: true, lastName: true, phone: true, email: true } } } },
      family: true,
      promotionHistory: { orderBy: { year: 'desc' } },
      timeline: { orderBy: { date: 'desc' }, take: 50 },
      vaccinations: { orderBy: { date: 'desc' } },
      documents: true,
      scholarshipWallet: true,
    },
  });
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });
  return Response.json(student);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  // Separate user fields from student fields — whitelist allowed fields
  const { firstName, lastName, phone, email } = body;

  const allowedStudentFields = [
    'admissionNo', 'dateOfBirth', 'gender', 'bloodGroup', 'classId', 'sectionId', 'parentId', 'familyId',
    'nationality', 'religion', 'category', 'aadhaarNumber', 'photo',
    'currentAddress', 'currentCity', 'currentState', 'currentPincode',
    'permanentAddress', 'permanentCity', 'permanentState', 'permanentPincode',
    'fatherName', 'fatherOccupation', 'fatherPhone', 'fatherEmail',
    'motherName', 'motherOccupation', 'motherPhone', 'motherEmail',
    'guardianName', 'guardianRelation', 'guardianPhone', 'annualIncome',
    'admissionDate', 'admittedGrade', 'house', 'stream', 'rollNumber',
    'prevSchoolName', 'prevSchoolBoard', 'prevLastGrade', 'prevTCNumber',
    'height', 'weight', 'vision', 'hearing', 'allergies', 'medicalConditions', 'disability',
    'emergencyContactName', 'emergencyContactPhone',
  ];
  const studentData: any = {};
  for (const key of allowedStudentFields) {
    if (body[key] !== undefined) studentData[key] = body[key];
  }

  // Convert date strings to Date objects
  if (studentData.dateOfBirth) studentData.dateOfBirth = new Date(studentData.dateOfBirth);
  if (studentData.admissionDate) studentData.admissionDate = new Date(studentData.admissionDate);

  try {
  const student = await prisma.student.update({
    where: { id },
    data: {
      ...studentData,
      user: { update: { firstName, lastName, phone, email } },
    },
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, avatar: true } },
      class: true,
      section: true,
    },
  });
  return Response.json(student);
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Student not found' }, { status: 404 });
    return Response.json({ error: 'Failed to update student' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });
  await prisma.user.delete({ where: { id: student.userId } });
  return Response.json({ message: 'Student deleted' });
}
