import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireScope } from '@/lib/apiAuth';
import { archiveStudentLedger } from '@/lib/feeLedger';

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
  const auth = await requireScope(request, 'students');
  if (auth instanceof Response) return auth;

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
    'emergencyContactName', 'emergencyContactPhone', 'feeExempt',
  ];
  const numericFields = ['annualIncome', 'height', 'weight'];
  const dateFields = ['dateOfBirth', 'admissionDate'];

  const studentData: any = {};
  for (const key of allowedStudentFields) {
    if (body[key] === undefined) continue;
    const value = body[key];
    // The edit form sends '' for empty optional fields. Prisma rejects '' on
    // typed columns (DateTime/Float/enum), so coerce blanks to null instead.
    if (value === '' || value === null) {
      studentData[key] = null;
    } else if (numericFields.includes(key)) {
      studentData[key] = Number(value);
    } else if (dateFields.includes(key)) {
      studentData[key] = new Date(value);
    } else {
      studentData[key] = value;
    }
  }

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
    if (error.code === 'P2002') {
      const field = Array.isArray(error.meta?.target) ? error.meta.target.join(', ') : 'a field';
      return Response.json({ error: `Duplicate value for ${field}` }, { status: 409 });
    }
    console.error('PUT /api/students/[id] failed:', error);
    return Response.json({ error: 'Failed to update student' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireScope(request, 'students');
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const sp = request.nextUrl.searchParams;
  // ?archiveFees=true → also soft-archive the student's fee ledger.
  // ?permanent=true   → HARD delete (admin only, student must already be left).
  const archiveFees = sp.get('archiveFees') === 'true';
  const permanent = sp.get('permanent') === 'true';
  const leftReason = sp.get('reason') || null;
  const tcNumber = sp.get('tcNumber') || null;

  const student = await prisma.student.findUnique({
    where: { id },
    include: { user: { select: { isActive: true } } },
  });
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });

  // Permanent removal — irreversible. Deleting the User cascades to the Student
  // and all their required child records (fees, grades, attendance, …).
  if (permanent) {
    if (auth.role !== 'ADMIN') {
      return Response.json({ error: 'Permanent delete requires an admin' }, { status: 403 });
    }
    if (student.user.isActive) {
      return Response.json({ error: 'Mark the student as left first, then permanently delete.' }, { status: 400 });
    }
    try {
      await prisma.user.delete({ where: { id: student.userId } });
      return Response.json({ deleted: true });
    } catch (e: any) {
      if (e.code === 'P2003') {
        return Response.json({ error: 'This student has linked records that block deletion.' }, { status: 409 });
      }
      return Response.json({ error: 'Failed to delete student: ' + e.message }, { status: 500 });
    }
  }

  let feesArchived = 0;
  if (archiveFees) {
    const result = await archiveStudentLedger(student.id, { actor: auth.userId, reason: 'Student deleted' });
    feesArchived = result.archived;
  }

  // Soft delete: deactivate the user instead of hard-deleting (preserves audit trail)
  if (leftReason || tcNumber) {
    await prisma.student.update({ where: { id }, data: { leftReason, tcNumber } });
  }
  await prisma.user.update({
    where: { id: student.userId },
    data: { isActive: false, deletedAt: new Date(), deletedBy: auth.userId },
  });
  return Response.json({ message: 'Student deactivated', feesArchived });
}

// POST /api/students/[id]/restore is handled in ./restore/route.ts
