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

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { category, title, description, amount, date, paidTo, paymentMode, receiptRef, academicYear } = body;

  if (!category || !title || !amount || !date) {
    return Response.json({ error: 'Category, title, amount, and date are required' }, { status: 400 });
  }

  const expense = await prisma.expense.create({
    data: {
      category, title, description, amount: parseFloat(amount),
      date: new Date(date), paidTo, paymentMode, receiptRef,
      academicYear: academicYear || '2025-2026',
    },
  });
  return Response.json(expense, { status: 201 });
}
