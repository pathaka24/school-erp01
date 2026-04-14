import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

const SIBLING_DISCOUNT_RATE = 0.05; // 5%

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { payments, paymentMethod, transactionId } = body as {
    payments: { studentId: string; feeStructureId: string; amount: number }[];
    paymentMethod: string;
    transactionId?: string;
  };

  if (!payments || payments.length === 0) {
    return Response.json({ error: 'At least one payment is required' }, { status: 400 });
  }

  // Validate all students and fee structures exist
  const studentIds = payments.map(p => p.studentId);
  const feeIds = payments.map(p => p.feeStructureId);

  const [students, feeStructures, existingPayments] = await Promise.all([
    prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true } }),
    prisma.feeStructure.findMany({ where: { id: { in: feeIds } }, select: { id: true } }),
    prisma.payment.findMany({
      where: {
        status: 'PAID',
        OR: payments.map(p => ({ studentId: p.studentId, feeStructureId: p.feeStructureId })),
      },
      select: { studentId: true, feeStructureId: true },
    }),
  ]);

  if (students.length !== new Set(studentIds).size) {
    return Response.json({ error: 'One or more students not found' }, { status: 404 });
  }
  if (feeStructures.length !== new Set(feeIds).size) {
    return Response.json({ error: 'One or more fee structures not found' }, { status: 404 });
  }

  // Check for already-paid fees
  if (existingPayments.length > 0) {
    const alreadyPaid = existingPayments.map(p => `${p.studentId}:${p.feeStructureId}`);
    return Response.json({ error: 'Some fees are already paid', alreadyPaid }, { status: 409 });
  }

  const applySiblingDiscount = payments.length >= 2;
  const familyReceiptId = `FRCP-${Date.now()}`;

  // Create all payments in a single transaction
  const createdPayments = await prisma.$transaction(
    payments.map((p, i) => {
      const discount = applySiblingDiscount ? p.amount * SIBLING_DISCOUNT_RATE : 0;
      const netAmount = p.amount - discount;

      return prisma.payment.create({
        data: {
          studentId: p.studentId,
          feeStructureId: p.feeStructureId,
          amountPaid: p.amount,
          discount,
          netAmount,
          status: 'PAID',
          paymentMethod,
          transactionId,
          receiptNumber: `${familyReceiptId}-${String(i + 1).padStart(2, '0')}`,
          familyReceiptId,
          paidDate: new Date(),
        },
        include: {
          student: { include: { user: { select: { firstName: true, lastName: true } } } },
          feeStructure: { select: { name: true, amount: true } },
        },
      });
    })
  );

  const subtotal = payments.reduce((s, p) => s + p.amount, 0);
  const totalDiscount = applySiblingDiscount ? subtotal * SIBLING_DISCOUNT_RATE : 0;

  return Response.json({
    familyReceiptId,
    payments: createdPayments,
    summary: {
      subtotal,
      siblingDiscount: totalDiscount,
      netPayable: subtotal - totalDiscount,
      studentCount: payments.length,
    },
  }, { status: 201 });
}
