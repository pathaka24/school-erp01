import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { ledgerDepositSchema, validate } from '@/lib/validations';

export async function POST(request: NextRequest) {
  const body = await request.json();
  // Accept either validated schema or raw body with perStudentAmounts
  const { studentIds, month, amount, paymentMethod, receivedBy, splitEvenly, perStudentAmounts } = body;

  if (!studentIds?.length || !month || !amount || !paymentMethod) {
    return Response.json({ error: 'studentIds, month, amount, and paymentMethod are required' }, { status: 400 });
  }

  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  if (students.length !== studentIds.length) {
    return Response.json({ error: 'One or more students not found' }, { status: 404 });
  }

  const receiptBase = `RCP-${Date.now()}`;
  // Determine per-student amounts
  // Priority: perStudentAmounts > splitEvenly > full amount to first student
  const hasCustomAmounts = perStudentAmounts && typeof perStudentAmounts === 'object';
  const shouldSplit = !hasCustomAmounts && splitEvenly !== false && studentIds.length > 1;

  const entries = await prisma.$transaction(
    studentIds.map((studentId: string, i: number) => {
      const studentName = students.find(s => s.id === studentId);
      const name = studentName ? `${studentName.user.firstName} ${studentName.user.lastName}` : '';

      let studentAmount: number;
      if (hasCustomAmounts && perStudentAmounts[studentId] != null) {
        studentAmount = parseFloat(perStudentAmounts[studentId]) || 0;
      } else if (shouldSplit) {
        studentAmount = amount / studentIds.length;
      } else {
        studentAmount = i === 0 ? amount : 0;
      }

      if (studentAmount <= 0) return null;

      const isCombined = studentIds.length > 1;
      return prisma.feeLedger.create({
        data: {
          studentId,
          month,
          type: 'DEPOSIT',
          category: 'DEPOSIT',
          description: `Deposit via ${paymentMethod}${isCombined ? ` (combined - ${name})` : ''}`,
          amount: studentAmount,
          balanceAfter: 0, // will be recalculated
          paymentMethod,
          receiptNumber: studentIds.length > 1 ? `${receiptBase}-${String(i + 1).padStart(2, '0')}` : receiptBase,
          receivedBy,
          date: new Date(),
        },
      });
    }).filter(Boolean)
  );

  // Recalculate balances for affected students
  for (const studentId of studentIds) {
    await recalculateBalance(studentId);
  }

  // Fetch updated entries
  const updatedEntries = await prisma.feeLedger.findMany({
    where: { id: { in: entries.map(e => e.id) } },
    include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
  });

  return Response.json({
    entries: updatedEntries,
    receipt: receiptBase,
    totalDeposited: amount,
    method: paymentMethod,
  }, { status: 201 });
}

async function recalculateBalance(studentId: string) {
  const allEntries = await prisma.feeLedger.findMany({
    where: { studentId },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });

  let balance = 0;
  for (const entry of allEntries) {
    if (entry.type === 'CHARGE') {
      balance += entry.amount;
    } else {
      balance -= entry.amount;
    }
    if (entry.balanceAfter !== balance) {
      await prisma.feeLedger.update({
        where: { id: entry.id },
        data: { balanceAfter: balance },
      });
    }
  }
}
