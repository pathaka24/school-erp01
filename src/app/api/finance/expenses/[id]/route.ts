import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { deriveStatus } from '../route';

// PATCH /api/finance/expenses/[id] — edit an expense or change its paid status.
// Body may include: { markPaid: true } shortcut, or paidAmount, or any editable
// field (category, title, description, amount, date, paidTo, paymentMode, receiptRef).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) return Response.json({ error: 'Expense not found' }, { status: 404 });

  const data: any = {};
  if (body.category !== undefined) data.category = body.category;
  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description;
  if (body.date !== undefined) data.date = new Date(body.date);
  if (body.paidTo !== undefined) data.paidTo = body.paidTo;
  if (body.paymentMode !== undefined) data.paymentMode = body.paymentMode;
  if (body.receiptRef !== undefined) data.receiptRef = body.receiptRef;

  const amount = body.amount !== undefined ? parseFloat(body.amount) : existing.amount;
  if (body.amount !== undefined) data.amount = amount;

  // Resolve paid amount: markPaid shortcut, explicit paidAmount, markUnpaid, else unchanged
  let paid = existing.paidAmount;
  if (body.markPaid) paid = amount;
  else if (body.markUnpaid) paid = 0;
  else if (body.paidAmount !== undefined && body.paidAmount !== '') paid = parseFloat(body.paidAmount);
  paid = Math.max(0, Math.min(paid, amount));

  if (paid !== existing.paidAmount || body.amount !== undefined) {
    data.paidAmount = paid;
    data.status = deriveStatus(amount, paid);
    data.paidDate = paid > 0 ? (existing.paidDate || new Date()) : null;
  }

  const updated = await prisma.expense.update({ where: { id }, data });
  return Response.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.expense.delete({ where: { id } });
    return Response.json({ message: 'Expense deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
