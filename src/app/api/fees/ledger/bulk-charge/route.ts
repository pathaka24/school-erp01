import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { bulkChargeSchema, validate } from '@/lib/validations';
import { recomputeStudentLedger } from '@/lib/feeLedger';
import { requireScope } from '@/lib/apiAuth';

export async function POST(request: NextRequest) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const v = validate(bulkChargeSchema, body);
  if ('error' in v) return v.error;
  const { classId, sectionId, month, category, description, amount } = v.data;

  // validation handled by zod above

  // Find all students in the class (and section if provided)
  const studentWhere: any = { classId };
  if (sectionId) {
    studentWhere.sectionId = sectionId;
  }

  const students = await prisma.student.findMany({
    where: studentWhere,
    select: { id: true },
  });

  if (students.length === 0) {
    return Response.json(
      { error: 'No students found for the given class/section' },
      { status: 404 }
    );
  }

  const entryDescription = description || (category || 'CHARGE').replace(/_/g, ' ');
  const entryDate = new Date(month + '-01T00:00:00Z');
  const safeDate = isNaN(entryDate.getTime()) ? new Date() : entryDate;

  let studentsCharged = 0;
  let studentsSkipped = 0;

  const chargedStudentIds: string[] = [];

  for (const student of students) {
    const existing = await prisma.feeLedger.findFirst({
      where: {
        studentId: student.id, month, type: 'CHARGE',
        category: category || undefined, voidedAt: null,
      },
    });
    if (existing) { studentsSkipped++; continue; }

    await prisma.feeLedger.create({
      data: {
        studentId: student.id,
        month,
        type: 'CHARGE',
        category: category || null,
        description: entryDescription,
        amount,
        balanceAfter: 0,
        date: safeDate,
      },
    });
    chargedStudentIds.push(student.id);
    studentsCharged++;
  }

  // Recompute balances + paidAmount for affected students
  for (const sid of chargedStudentIds) {
    await recomputeStudentLedger(sid);
  }

  const totalAmount = studentsCharged * amount;

  return Response.json(
    { studentsCharged, studentsSkipped, totalAmount },
    { status: 201 }
  );
}
