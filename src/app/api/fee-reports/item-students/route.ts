import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireScope } from '@/lib/apiAuth';

// GET /api/fee-reports/item-students?category=BOOK
// The list of students charged for a given item/category (Books, Tie/Belt, …),
// with each student's total for that item + how much is paid / still due.
export async function GET(request: NextRequest) {
  const auth = await requireScope(request, 'reports');
  if (auth instanceof Response) return auth;

  const category = request.nextUrl.searchParams.get('category');
  if (!category) return Response.json({ error: 'category is required' }, { status: 400 });

  const groups = await prisma.feeLedger.groupBy({
    by: ['studentId'],
    where: { type: 'CHARGE', category, voidedAt: null, archivedAt: null },
    _sum: { amount: true, paidAmount: true },
    _count: { id: true },
  });
  if (groups.length === 0) return Response.json({ category, students: [], total: 0 });

  const ids = groups.map(g => g.studentId);
  const students = await prisma.student.findMany({
    where: { id: { in: ids } },
    include: {
      user: { select: { firstName: true, lastName: true, isActive: true } },
      class: { select: { name: true, numericGrade: true } },
      section: { select: { name: true } },
    },
  });
  const sById = new Map(students.map(s => [s.id, s]));

  const rows = groups.map(g => {
    const s = sById.get(g.studentId);
    const amount = g._sum.amount || 0;
    const paid = g._sum.paidAmount || 0;
    return {
      studentId: g.studentId,
      name: s ? `${s.user.firstName} ${s.user.lastName}`.trim() : '?',
      admissionNo: s?.admissionNo || '',
      class: s?.class?.name || '—',
      section: s?.section?.name || '',
      numericGrade: s?.class?.numericGrade ?? 999,
      active: s?.user.isActive ?? true,
      qty: g._count.id,
      amount,
      paid,
      due: Math.max(0, amount - paid),
    };
  }).sort((a, b) => a.numericGrade - b.numericGrade || a.name.localeCompare(b.name));

  return Response.json({
    category,
    students: rows,
    total: rows.reduce((s, r) => s + r.amount, 0),
    count: rows.length,
  });
}
