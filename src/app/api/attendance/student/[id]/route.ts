import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = request.nextUrl;
  const month = searchParams.get('month');
  const year = searchParams.get('year');

  const where: any = { studentId: id };
  if (month && year) {
    const start = new Date(Number(year), Number(month) - 1, 1);
    const end = new Date(Number(year), Number(month), 0);
    where.date = { gte: start, lte: end };
  }

  const attendance = await prisma.attendance.findMany({ where, orderBy: { date: 'desc' } });

  const total = attendance.length;
  const present = attendance.filter(a => a.status === 'PRESENT').length;
  const absent = attendance.filter(a => a.status === 'ABSENT').length;
  const late = attendance.filter(a => a.status === 'LATE').length;

  return Response.json({
    records: attendance,
    summary: { total, present, absent, late, percentage: total > 0 ? ((present + late) / total * 100).toFixed(1) : '0' },
  });
}
