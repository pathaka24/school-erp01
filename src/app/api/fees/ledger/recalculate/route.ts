import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { recomputeStudentLedger } from '@/lib/feeLedger';
import { requireScope } from '@/lib/apiAuth';

// POST /api/fees/ledger/recalculate
// Body: { studentId } — recalculate one student
// Body: { all: true } — recalculate ALL students (admin)
//
// Recomputes both running balances and paidAmount (FIFO) for each student.
export async function POST(request: NextRequest) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const { studentId, all } = body;

  if (!studentId && !all) {
    return Response.json({ error: 'Provide studentId or { all: true }' }, { status: 400 });
  }

  const results: { studentId: string; entriesProcessed: number; balance: number }[] = [];

  if (all) {
    const studentIds = await prisma.feeLedger.findMany({
      select: { studentId: true },
      distinct: ['studentId'],
    });
    for (const { studentId: sid } of studentIds) {
      const r = await recomputeStudentLedger(sid);
      results.push({ studentId: sid, ...r });
    }
  } else {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });
    const r = await recomputeStudentLedger(studentId);
    results.push({ studentId, ...r });
  }

  return Response.json({
    studentsProcessed: results.length,
    results,
  });
}
