import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { ledgerChargeSchema, validate } from '@/lib/validations';
import { recomputeStudentLedger } from '@/lib/feeLedger';
import { requireScope } from '@/lib/apiAuth';

export async function POST(request: NextRequest) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const v = validate(ledgerChargeSchema, body);
  if ('error' in v) return v.error;
  const { studentIds, month, category, description, amount } = v.data;

  // Optional per-student amounts (family view: charge each child a different fee).
  // When present, ONLY students with their own amount are charged — a child left
  // blank (fee 0) is skipped, NOT charged the flat fallback amount.
  const perStudent: Record<string, any> | null =
    body.perStudentAmounts && typeof body.perStudentAmounts === 'object' ? body.perStudentAmounts : null;
  const amountFor = (sid: string): number => {
    if (perStudent) {
      const v = perStudent[sid];
      if (v == null || v === '') return 0; // blank child → skip
      const n = parseFloat(String(v));
      return isNaN(n) ? 0 : n;
    }
    return amount;
  };

  const entryDescription = description || (category || 'CHARGE').replace(/_/g, ' ');

  // Validate students exist
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true },
  });
  if (students.length !== studentIds.length) {
    return Response.json({ error: 'One or more students not found' }, { status: 404 });
  }

  // Monthly fee is once-per-month and also auto-accrued — never add a second one
  // for a month that already has it. Skip those students; error if all are dups.
  let targetIds = studentIds as string[];
  if (category === 'MONTHLY_FEE') {
    const existing = await prisma.feeLedger.findMany({
      where: { studentId: { in: targetIds }, month, type: 'CHARGE', category: 'MONTHLY_FEE', voidedAt: null },
      select: { studentId: true },
    });
    const have = new Set(existing.map(e => e.studentId));
    targetIds = targetIds.filter(sid => !have.has(sid));
    if (targetIds.length === 0) {
      const label = new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      return Response.json({ error: `A monthly fee for ${label} already exists — it's added automatically, no need to add it again.` }, { status: 409 });
    }
  }

  // Charge date: explicit entryDate (with real time) if given, else default to
  // the first of the month (keeps month-start ordering for callers that don't set it,
  // e.g. opening-balance / previous-year charges).
  const parsed = body.entryDate ? new Date(body.entryDate) : null;
  const chargeDate = parsed && !isNaN(parsed.getTime())
    ? parsed
    : (() => { const d = new Date(month + '-01T00:00:00Z'); return isNaN(d.getTime()) ? new Date() : d; })();

  // Create charge entries for each student. balanceAfter is filled in after.
  const entries = [];
  const affected: string[] = [];
  for (const studentId of targetIds) {
    const amt = amountFor(studentId);
    if (!(amt > 0)) continue; // skip students with no amount in per-student mode
    const entry = await prisma.feeLedger.create({
      data: {
        studentId,
        month,
        type: 'CHARGE',
        category,
        description: entryDescription,
        amount: amt,
        balanceAfter: 0,
        date: chargeDate,
      },
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
    entries.push(entry);
    affected.push(studentId);
  }

  if (entries.length === 0) {
    return Response.json({ error: 'No amounts entered' }, { status: 400 });
  }

  // Recompute balances + paidAmount for each affected student
  for (const studentId of affected) {
    await recomputeStudentLedger(studentId);
  }

  // Re-fetch with updated balances
  const updated = await prisma.feeLedger.findMany({
    where: { id: { in: entries.map(e => e.id) } },
    include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
  });

  return Response.json(updated, { status: 201 });
}
