import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireScope } from '@/lib/apiAuth';

// GET /api/fees/promise?status=PENDING&due=overdue|today|week
// List payment promises (follow-ups) with student + phone, sorted by promised date.
export async function GET(request: NextRequest) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const sp = request.nextUrl.searchParams;
  const status = sp.get('status');
  const due = sp.get('due'); // overdue | today | week
  const studentId = sp.get('studentId');

  const where: any = {};
  if (status) where.status = status;
  if (studentId) where.studentId = studentId;
  if (due) {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    if (due === 'overdue') where.promisedDate = { lt: now };
    else if (due === 'today') { const end = new Date(now); end.setDate(end.getDate() + 1); where.promisedDate = { gte: now, lt: end }; }
    else if (due === 'week') { const end = new Date(now); end.setDate(end.getDate() + 7); where.promisedDate = { gte: now, lt: end }; }
  }

  const promises = await prisma.feePromise.findMany({
    where,
    orderBy: { promisedDate: 'asc' },
    include: {
      student: {
        include: {
          user: { select: { firstName: true, lastName: true, phone: true } },
          class: { select: { name: true } },
          section: { select: { name: true } },
        },
      },
    },
  });

  // Attach each student's current balance (latest non-voided ledger entry)
  const ids = Array.from(new Set(promises.map(p => p.studentId)));
  const balances = ids.length === 0 ? [] : await prisma.feeLedger.findMany({
    where: { studentId: { in: ids }, voidedAt: null, archivedAt: null },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    distinct: ['studentId'],
    select: { studentId: true, balanceAfter: true },
  });
  const balById = new Map(balances.map(b => [b.studentId, b.balanceAfter]));

  return Response.json({
    promises: promises.map(p => ({
      id: p.id,
      studentId: p.studentId,
      name: `${p.student.user.firstName} ${p.student.user.lastName}`.trim(),
      phone: p.student.fatherPhone || p.student.motherPhone || p.student.guardianPhone || p.student.user.phone || null,
      class: p.student.class?.name,
      section: p.student.section?.name,
      admissionNo: p.student.admissionNo,
      promisedDate: p.promisedDate,
      amount: p.amount,
      reason: p.reason,
      status: p.status,
      createdBy: p.createdBy,
      createdAt: p.createdAt,
      balance: balById.get(p.studentId) ?? 0,
    })),
  });
}

// POST /api/fees/promise  { studentId, promisedDate, amount?, reason? }
export async function POST(request: NextRequest) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const body = await request.json();
  if (!body.studentId) return Response.json({ error: 'studentId is required' }, { status: 400 });
  if (!body.promisedDate) return Response.json({ error: 'promisedDate is required' }, { status: 400 });
  const d = new Date(body.promisedDate);
  if (isNaN(d.getTime())) return Response.json({ error: 'Invalid promisedDate' }, { status: 400 });

  const student = await prisma.student.findUnique({ where: { id: body.studentId }, select: { id: true } });
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });

  const promise = await prisma.feePromise.create({
    data: {
      studentId: body.studentId,
      promisedDate: d,
      amount: body.amount != null && body.amount !== '' ? parseFloat(body.amount) : null,
      reason: body.reason ? String(body.reason).trim() : null,
      status: 'PENDING',
      createdBy: body._actor || `${auth.userId}`,
    },
  });
  return Response.json(promise, { status: 201 });
}
