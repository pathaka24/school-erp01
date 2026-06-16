import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const category = searchParams.get('category');
  const academicYear = searchParams.get('academicYear');

  const where: any = {};
  if (category) where.category = category;
  if (academicYear) where.academicYear = academicYear;

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { date: 'desc' },
  });
  return Response.json(expenses);
}

// Derive a consistent status from amount + paidAmount
export function deriveStatus(amount: number, paid: number): 'PAID' | 'UNPAID' | 'PARTIAL' {
  if (paid <= 0.005) return 'UNPAID';
  if (paid >= amount - 0.005) return 'PAID';
  return 'PARTIAL';
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { category, title, description, amount, date, paidTo, paymentMode, receiptRef, academicYear, status } = body;

  if (!category || !title || !amount || !date) {
    return Response.json({ error: 'Category, title, amount, and date are required' }, { status: 400 });
  }

  const amt = parseFloat(amount);
  // paidAmount: explicit if given, else UNPAID→0, else fully paid (back-compat default)
  let paid: number;
  if (body.paidAmount !== undefined && body.paidAmount !== '') paid = parseFloat(body.paidAmount);
  else if (status === 'UNPAID') paid = 0;
  else paid = amt;
  paid = Math.max(0, Math.min(paid, amt));
  const finalStatus = deriveStatus(amt, paid);

  const expense = await prisma.expense.create({
    data: {
      category, title, description, amount: amt,
      paidAmount: paid, status: finalStatus,
      paidDate: paid > 0 ? new Date(date) : null,
      date: new Date(date), paidTo, paymentMode, receiptRef,
      academicYear: academicYear || '2025-2026',
    },
  });
  return Response.json(expense, { status: 201 });
}
