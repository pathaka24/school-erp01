import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireScope } from '@/lib/apiAuth';

// GET /api/fee-reports/audit-log?studentId=&action=&from=&to=&limit=&offset=
//
// Returns paginated FeeLedgerAudit rows. ADMIN only — audit data is sensitive.
export async function GET(request: NextRequest) {
  const auth = await requireScope(request, 'reports');
  if (auth instanceof Response) return auth;

  const sp = request.nextUrl.searchParams;
  const studentId = sp.get('studentId');
  const action = sp.get('action');
  const from = sp.get('from');
  const to = sp.get('to');
  const limit = Math.min(200, parseInt(sp.get('limit') || '50', 10));
  const offset = parseInt(sp.get('offset') || '0', 10);

  const where: any = {};
  if (studentId) where.studentId = studentId;
  if (action) where.action = action;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const [rows, total] = await Promise.all([
    prisma.feeLedgerAudit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.feeLedgerAudit.count({ where }),
  ]);

  // Resolve student names for the page of rows
  const studentIds = Array.from(new Set(rows.map(r => r.studentId)));
  const students = studentIds.length === 0 ? [] : await prisma.student.findMany({
    where: { id: { in: studentIds } },
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  const nameById = new Map(students.map(s => [s.id, `${s.user.firstName} ${s.user.lastName}`.trim()]));

  return Response.json({
    rows: rows.map(r => ({
      ...r,
      before: r.before ? JSON.parse(r.before) : null,
      after: r.after ? JSON.parse(r.after) : null,
      studentName: nameById.get(r.studentId) || null,
    })),
    total,
    limit,
    offset,
  });
}
