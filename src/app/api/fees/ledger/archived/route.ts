import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireScope } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

// GET /api/fees/ledger/archived?search=&classId=&state=archived|voided
// School-wide list of set-aside ledger entries:
//   state=archived (default) → archivedAt set, not voided
//   state=voided             → voidedAt set (soft-deleted)
// Restore/permanent-delete: archived via /api/fees/ledger/entry/archive,
// voided via /api/fees/ledger/entry/void-restore.
export async function GET(request: NextRequest) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const sp = request.nextUrl.searchParams;
  const search = (sp.get('search') || '').trim();
  const classId = sp.get('classId');
  const state = sp.get('state') === 'voided' ? 'voided' : 'archived';

  const where: any = state === 'voided'
    ? { voidedAt: { not: null } }
    : { archivedAt: { not: null }, voidedAt: null };
  const studentWhere: any = {};
  if (classId) studentWhere.classId = classId;
  if (search) {
    studentWhere.OR = [
      { user: { firstName: { contains: search, mode: 'insensitive' } } },
      { user: { lastName: { contains: search, mode: 'insensitive' } } },
      { admissionNo: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (Object.keys(studentWhere).length) where.student = studentWhere;

  const entries = await prisma.feeLedger.findMany({
    where,
    include: {
      student: {
        include: {
          user: { select: { firstName: true, lastName: true, isActive: true } },
          class: { select: { name: true } },
          section: { select: { name: true } },
        },
      },
    },
    orderBy: state === 'voided' ? [{ voidedAt: 'desc' }] : [{ archivedAt: 'desc' }],
    take: 500,
  });

  const rows = entries.map(e => ({
    id: e.id,
    studentId: e.studentId,
    name: `${e.student.user.firstName} ${e.student.user.lastName}`.trim(),
    admissionNo: e.student.admissionNo,
    class: e.student.class?.name || '',
    section: e.student.section?.name || '',
    active: e.student.user.isActive, // false = student has left / been removed
    date: e.date,
    month: e.month,
    type: e.type,
    category: e.category,
    description: e.description,
    amount: e.amount,
    archivedAt: e.archivedAt,
    archivedBy: e.archivedBy,
    voidedAt: e.voidedAt,
    voidedBy: e.voidedBy,
    voidReason: e.voidReason,
  }));

  const totals = {
    count: rows.length,
    students: new Set(rows.map(r => r.studentId)).size,
    charges: rows.filter(r => r.type === 'CHARGE').reduce((s, r) => s + r.amount, 0),
    credits: rows.filter(r => r.type !== 'CHARGE').reduce((s, r) => s + r.amount, 0),
    capped: entries.length >= 500,
  };

  return Response.json({ rows, totals });
}
