import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/exam-fees?classId=xxx&examId=xxx&session=2025-2026
export async function GET(request: NextRequest) {
  const classId = request.nextUrl.searchParams.get('classId');
  const examId = request.nextUrl.searchParams.get('examId');
  const session = request.nextUrl.searchParams.get('session');

  if (!classId) return Response.json({ error: 'classId required' }, { status: 400 });

  // Get students
  const students = await prisma.student.findMany({
    where: { classId },
    include: { user: { select: { firstName: true, lastName: true } }, section: { select: { name: true } } },
    orderBy: { user: { firstName: 'asc' } },
  });

  // Get exam fee entries from fee ledger (category = EXAM_FEE)
  const monthFilter = session ? { startsWith: session.split('-')[0] } : undefined;
  const feeEntries = await prisma.feeLedger.findMany({
    where: {
      studentId: { in: students.map(s => s.id) },
      category: 'EXAM_FEE',
      ...(examId ? { description: { contains: examId } } : {}),
    },
    orderBy: { date: 'desc' },
  });

  const feeMap = new Map<string, any[]>();
  feeEntries.forEach(e => {
    if (!feeMap.has(e.studentId)) feeMap.set(e.studentId, []);
    feeMap.get(e.studentId)!.push(e);
  });

  // Get exams for this class
  const exams = await prisma.exam.findMany({
    where: { classId },
    select: { id: true, name: true, type: true, startDate: true },
    orderBy: { startDate: 'desc' },
  });

  const data = students.map(s => ({
    id: s.id,
    name: `${s.user.firstName} ${s.user.lastName}`,
    admissionNo: s.admissionNo,
    section: s.section?.name,
    rollNumber: s.rollNumber,
    examFees: feeMap.get(s.id) || [],
    totalPaid: (feeMap.get(s.id) || []).filter(e => e.type === 'DEPOSIT').reduce((sum, e) => sum + e.amount, 0),
    totalCharged: (feeMap.get(s.id) || []).filter(e => e.type === 'CHARGE').reduce((sum, e) => sum + e.amount, 0),
  }));

  return Response.json({ students: data, exams });
}

// POST /api/exam-fees — charge or collect exam fee
export async function POST(request: NextRequest) {
  const { studentIds, examName, amount, type, paymentMethod, receivedBy, month } = await request.json();

  if (!studentIds?.length || !amount || !type) {
    return Response.json({ error: 'studentIds, amount, type required' }, { status: 400 });
  }

  const entryMonth = month || new Date().toISOString().slice(0, 7);
  const entries: any[] = [];

  for (const studentId of studentIds) {
    const lastEntry = await prisma.feeLedger.findFirst({
      where: { studentId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: { balanceAfter: true },
    });
    const currentBalance = lastEntry?.balanceAfter ?? 0;
    const newBalance = type === 'CHARGE' ? currentBalance + amount : currentBalance - amount;

    const entry = await prisma.feeLedger.create({
      data: {
        studentId,
        month: entryMonth,
        type,
        category: 'EXAM_FEE',
        description: `Exam Fee${examName ? ' - ' + examName : ''}`,
        amount,
        balanceAfter: newBalance,
        ...(type === 'DEPOSIT' ? { paymentMethod: paymentMethod || 'CASH', receivedBy: receivedBy || null, receiptNumber: `EXAM-${Date.now()}-${entries.length}` } : {}),
        date: new Date(),
      },
    });
    entries.push(entry);
  }

  return Response.json({ message: `${type === 'CHARGE' ? 'Charged' : 'Collected'} exam fee for ${entries.length} students`, entries }, { status: 201 });
}
