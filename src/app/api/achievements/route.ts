import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const studentId = request.nextUrl.searchParams.get('studentId');
  if (!studentId) return Response.json({ error: 'studentId required' }, { status: 400 });

  const achievements = await prisma.achievement.findMany({
    where: { studentId },
    orderBy: { date: 'desc' },
  });
  return Response.json(achievements);
}

export async function POST(request: NextRequest) {
  const { studentId, type, title, description, date } = await request.json();
  const achievement = await prisma.achievement.create({
    data: { studentId, type, title, description, date: new Date(date) },
  });
  return Response.json(achievement, { status: 201 });
}
