import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  const { date, records } = await request.json();

  const results = await Promise.all(
    records.map((r: any) =>
      prisma.attendance.upsert({
        where: { studentId_date: { studentId: r.studentId, date: new Date(date) } },
        update: { status: r.status, remarks: r.remarks },
        create: { studentId: r.studentId, date: new Date(date), status: r.status, remarks: r.remarks },
      })
    )
  );

  return Response.json({ message: 'Attendance marked', count: results.length });
}
