import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/teachers/[id]/attendance?month=2026-04
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const monthParam = req.nextUrl.searchParams.get('month');
  const now = new Date();
  const [year, month] = monthParam ? monthParam.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1];

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const records = await (prisma as any).teacherAttendance.findMany({
    where: { teacherId: id, date: { gte: start, lt: end } },
    orderBy: { date: 'asc' },
  });

  const total = records.length;
  const present = records.filter((r: any) => r.status === 'PRESENT' || r.status === 'LATE').length;
  const absent = records.filter((r: any) => r.status === 'ABSENT').length;
  const late = records.filter((r: any) => r.status === 'LATE').length;

  return Response.json({
    month: `${year}-${String(month).padStart(2, '0')}`,
    records,
    summary: { total, present, absent, late, pct: total > 0 ? Math.round((present / total) * 100) : 0 },
  });
}
