import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { feePaySchema, validate } from '@/lib/validations';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const v = validate(feePaySchema, body);
  if ('error' in v) return v.error;
  const { studentId, feeStructureId, amountPaid, paymentMethod, transactionId, receiptNumber, discount, scholarshipAmt, familyReceiptId } = v.data;

  // Check student and fee structure exist
  const [student, feeStructure] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId } }),
    prisma.feeStructure.findUnique({ where: { id: feeStructureId } }),
  ]);
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });
  if (!feeStructure) return Response.json({ error: 'Fee structure not found' }, { status: 404 });

  // Prevent duplicate: same student + same fee already PAID
  const existing = await prisma.payment.findFirst({
    where: { studentId, feeStructureId, status: 'PAID' },
  });
  if (existing) {
    return Response.json({ error: 'This fee is already paid', existingReceiptNumber: existing.receiptNumber }, { status: 409 });
  }

  const discountAmt = discount || 0;
  const scholarshipAmount = scholarshipAmt || 0;
  const netAmount = amountPaid - discountAmt - scholarshipAmount;

  const payment = await prisma.payment.create({
    data: {
      studentId, feeStructureId, amountPaid, status: 'PAID',
      paymentMethod, transactionId, receiptNumber, paidDate: new Date(),
      discount: discountAmt, scholarshipAmt: scholarshipAmount,
      netAmount, familyReceiptId,
    },
    include: {
      student: { include: { user: { select: { firstName: true, lastName: true } } } },
      feeStructure: { select: { name: true, amount: true } },
    },
  });
  return Response.json(payment, { status: 201 });
}
