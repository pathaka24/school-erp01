import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { recomputeStudentLedger } from '@/lib/feeLedger';
import { requireScope } from '@/lib/apiAuth';

// POST /api/fees/ledger/apply-annual
// Body: { classId, sectionId?, month: 'YYYY-MM', charges: [{ category, description, amount }] }
//
// Applies one-time yearly charges (Annual, Books, Dress, Copy, Dairy, Tie/Belt…)
// to every student in a class/section in one pass. Dedups per (category +
// description) across the whole academic year — so a student already charged
// for "Books" this year (e.g. at admission) is skipped, and re-running is safe.
export async function POST(request: NextRequest) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const { classId, sectionId, month, charges } = body as {
    classId?: string; sectionId?: string; month?: string;
    charges?: { category: string; description: string; amount: number | string }[];
  };

  if (!classId) return Response.json({ error: 'classId is required' }, { status: 400 });
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return Response.json({ error: 'month (YYYY-MM) is required' }, { status: 400 });
  }
  const items = (charges || [])
    .map(c => ({ category: c.category, description: (c.description || c.category).trim(), amount: parseFloat(String(c.amount)) || 0 }))
    .filter(c => c.amount > 0 && c.description);
  if (items.length === 0) {
    return Response.json({ error: 'No charges with a positive amount were provided' }, { status: 400 });
  }

  const students = await prisma.student.findMany({
    where: { classId, ...(sectionId ? { sectionId } : {}), user: { isActive: true } },
    select: { id: true },
  });
  if (students.length === 0) {
    return Response.json({ error: 'No active students found for the given class/section' }, { status: 404 });
  }
  const ids = students.map(s => s.id);

  // Months of the academic year (Apr–Mar) that `month` falls in
  const [y, m] = month.split('-').map(Number);
  const startYear = m >= 4 ? y : y - 1;
  const yearMonths: string[] = [];
  for (let mm = 4; mm <= 12; mm++) yearMonths.push(`${startYear}-${String(mm).padStart(2, '0')}`);
  for (let mm = 1; mm <= 3; mm++) yearMonths.push(`${startYear + 1}-${String(mm).padStart(2, '0')}`);

  // Existing charges this academic year → skip set keyed by student|category|description
  const existing = await prisma.feeLedger.findMany({
    where: { studentId: { in: ids }, type: 'CHARGE', voidedAt: null, month: { in: yearMonths } },
    select: { studentId: true, category: true, description: true },
  });
  const seen = new Set(existing.map(e => `${e.studentId}|${e.category || ''}|${e.description}`));

  const entryDate = new Date(month + '-01T00:00:00Z');
  const safeDate = isNaN(entryDate.getTime()) ? new Date() : entryDate;

  const toCreate: any[] = [];
  const affected = new Set<string>();
  let skipped = 0;
  for (const sid of ids) {
    for (const it of items) {
      if (seen.has(`${sid}|${it.category}|${it.description}`)) { skipped++; continue; }
      toCreate.push({
        studentId: sid, month, date: safeDate,
        type: 'CHARGE', category: it.category, description: it.description,
        amount: it.amount, balanceAfter: 0,
      });
      affected.add(sid);
    }
  }

  if (toCreate.length > 0) {
    await prisma.feeLedger.createMany({ data: toCreate });
    for (const sid of affected) await recomputeStudentLedger(sid);
  }

  return Response.json({
    chargesCreated: toCreate.length,
    studentsAffected: affected.size,
    skipped,
    totalAmount: toCreate.reduce((t, c) => t + c.amount, 0),
  }, { status: 201 });
}
