import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { ledgerChargeSchema, validate } from '@/lib/validations';

export async function POST(request: NextRequest) {
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

  // Create charge entries for each student
  const entries = [];
  for (const studentId of studentIds) {
    // Get current balance for this student
    const lastEntry = await prisma.feeLedger.findFirst({
      where: { studentId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: { balanceAfter: true },
    });

    const currentBalance = lastEntry?.balanceAfter ?? 0;
    const newBalance = currentBalance + amount;

    // Set date to first of the target month (so entries sort chronologically)
    const entryDate = new Date(month + '-01T00:00:00Z');

    const entry = await prisma.feeLedger.create({
      data: {
        studentId,
        month,
        type: 'CHARGE',
        category,
        description: entryDescription,
        amount,
        balanceAfter: newBalance,
        date: isNaN(entryDate.getTime()) ? new Date() : entryDate,
      },
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
    entries.push(entry);
  }

  return Response.json(entries, { status: 201 });
}
