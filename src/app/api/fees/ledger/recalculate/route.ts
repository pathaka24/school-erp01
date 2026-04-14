import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// POST /api/fees/ledger/recalculate
// Body: { studentId } — recalculate one student
// Body: { all: true } — recalculate ALL students (admin)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { studentId, all } = body;

  if (!studentId && !all) {
    return Response.json({ error: 'Provide studentId or { all: true }' }, { status: 400 });
  }

  const results: { studentId: string; name: string; entriesFixed: number; oldBalance: number; newBalance: number }[] = [];

  if (all) {
    // Get all students who have ledger entries
    const studentIds = await prisma.feeLedger.findMany({
      select: { studentId: true },
      distinct: ['studentId'],
    });
    for (const { studentId: sid } of studentIds) {
      const result = await recalculate(sid);
      results.push(result);
    }
  } else {
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });
    const result = await recalculate(studentId);
    results.push(result);
  }

  const totalFixed = results.reduce((s, r) => s + r.entriesFixed, 0);

  return Response.json({
    studentsProcessed: results.length,
    totalEntriesFixed: totalFixed,
    results,
  });
}

async function recalculate(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: { select: { firstName: true, lastName: true } } },
  });

  const entries = await prisma.feeLedger.findMany({
    where: { studentId },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });

  const oldBalance = entries.length > 0 ? entries[entries.length - 1].balanceAfter : 0;
  let balance = 0;
  let fixed = 0;

  for (const entry of entries) {
    if (entry.type === 'CHARGE') {
      balance += entry.amount;
    } else if (entry.type === 'DEPOSIT') {
      balance -= entry.amount;
    }

    if (Math.abs(entry.balanceAfter - balance) > 0.01) {
      await prisma.feeLedger.update({
        where: { id: entry.id },
        data: { balanceAfter: balance },
      });
      fixed++;
    }
  }

  return {
    studentId,
    name: student ? `${student.user.firstName} ${student.user.lastName}` : studentId,
    entriesFixed: fixed,
    oldBalance,
    newBalance: balance,
  };
}
