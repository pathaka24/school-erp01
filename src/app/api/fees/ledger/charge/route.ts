import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { ledgerChargeSchema, validate } from '@/lib/validations';
import { recomputeStudentLedger } from '@/lib/feeLedger';
import { requireScope } from '@/lib/apiAuth';

export async function POST(request: NextRequest) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const v = validate(ledgerChargeSchema, body);
  if ('error' in v) return v.error;
  const { studentIds, month, category, description, amount } = v.data;

  const entryDescription = description || (category || 'CHARGE').replace(/_/g, ' ');

  // Validate students exist
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true },
  });
  if (students.length !== studentIds.length) {
    return Response.json({ error: 'One or more students not found' }, { status: 404 });
  }

  // Create charge entries for each student. balanceAfter is filled in after.
  const entries = [];
  for (const studentId of studentIds) {
    const entryDate = new Date(month + '-01T00:00:00Z');
    const entry = await prisma.feeLedger.create({
      data: {
        studentId,
        month,
        type: 'CHARGE',
        category,
        description: entryDescription,
        amount,
        balanceAfter: 0,
        date: isNaN(entryDate.getTime()) ? new Date() : entryDate,
      },
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
    entries.push(entry);
  }

  // Recompute balances + paidAmount for each affected student
  for (const studentId of studentIds) {
    await recomputeStudentLedger(studentId);
  }

  // Re-fetch with updated balances
  const updated = await prisma.feeLedger.findMany({
    where: { id: { in: entries.map(e => e.id) } },
    include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
  });

  return Response.json(updated, { status: 201 });
}
