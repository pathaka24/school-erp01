import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const month = searchParams.get('month');
  const status = searchParams.get('status');

  const where: any = {};
  if (month) where.month = month;
  if (status) where.status = status;

  const salaries = await prisma.salary.findMany({
    where,
    include: {
      teacher: {
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return Response.json(salaries);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { teacherId, month, basicPay, hra, da, ta, deductions } = body;

  if (!teacherId || !month || !basicPay) {
    return Response.json({ error: 'Teacher, month, and basic pay are required' }, { status: 400 });
  }

  const netPay = parseFloat(basicPay) + parseFloat(hra || 0) + parseFloat(da || 0) + parseFloat(ta || 0) - parseFloat(deductions || 0);

  try {
    const salary = await prisma.salary.upsert({
      where: { teacherId_month: { teacherId, month } },
      update: { basicPay: parseFloat(basicPay), hra: parseFloat(hra || 0), da: parseFloat(da || 0), ta: parseFloat(ta || 0), deductions: parseFloat(deductions || 0), netPay },
      create: { teacherId, month, basicPay: parseFloat(basicPay), hra: parseFloat(hra || 0), da: parseFloat(da || 0), ta: parseFloat(ta || 0), deductions: parseFloat(deductions || 0), netPay },
      include: { teacher: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });
    return Response.json(salary, { status: 201 });
  } catch (error: any) {
    return Response.json({ error: 'Failed to create salary' }, { status: 500 });
  }
}
