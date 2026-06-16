import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { recomputeStudentLedger } from '@/lib/feeLedger';
import { requireScope } from '@/lib/apiAuth';

// POST /api/fees/ledger/generate-monthly
// Body: { month: 'YYYY-MM', classId?: string, sectionId?: string }
// Creates MONTHLY_FEE charge entries for all matching students using each
// class's monthlyFee from SchoolSettings.feePlan. Skips students who already
// have a MONTHLY_FEE entry for that month.
export async function POST(request: NextRequest) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const { month, classId, sectionId } = body;

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return Response.json({ error: 'month is required in YYYY-MM format' }, { status: 400 });
  }

  // Pull per-class monthly fees from the saved fee plan
  const feePlanSetting = await prisma.schoolSettings.findUnique({ where: { key: 'feePlan' } });
  if (!feePlanSetting) {
    return Response.json({ error: 'Fee plan not configured. Set monthly fees in Settings → Annual Fee Plan first.' }, { status: 400 });
  }

  let plan: any;
  try { plan = JSON.parse(feePlanSetting.value); } catch {
    return Response.json({ error: 'Fee plan is corrupted' }, { status: 500 });
  }

  const monthlyFeeByClass = new Map<string, number>();
  for (const c of plan?.classes || []) {
    const amount = Number(c.monthlyFee) || 0;
    if (amount > 0) monthlyFeeByClass.set(c.classId, amount);
  }

  if (monthlyFeeByClass.size === 0) {
    return Response.json({ error: 'No classes have a monthly fee set in the fee plan' }, { status: 400 });
  }

  // Pick which students to charge — never charge soft-deleted (deactivated)
  // students or students marked fee-exempt
  const studentWhere: any = { user: { isActive: true }, feeExempt: false };
  if (classId) studentWhere.classId = classId;
  if (sectionId) studentWhere.sectionId = sectionId;

  const students = await prisma.student.findMany({
    where: studentWhere,
    select: { id: true, classId: true, user: { select: { firstName: true, lastName: true } } },
  });

  if (students.length === 0) {
    return Response.json({ error: 'No students match the given filters' }, { status: 404 });
  }

  const entryDate = new Date(month + '-01T00:00:00Z');
  const safeDate = isNaN(entryDate.getTime()) ? new Date() : entryDate;
  const monthLabel = new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  let skipped = 0;
  const skippedNoFee: string[] = [];

  // One query for all students already charged this month (instead of N findFirsts)
  const existingRows = await prisma.feeLedger.findMany({
    where: {
      studentId: { in: students.map(s => s.id) },
      month, type: 'CHARGE', category: 'MONTHLY_FEE', voidedAt: null,
    },
    select: { studentId: true },
  });
  const alreadyCharged = new Set(existingRows.map(r => r.studentId));

  const toCharge: { id: string; amount: number }[] = [];
  for (const s of students) {
    const amount = monthlyFeeByClass.get(s.classId);
    if (!amount) {
      skipped++;
      skippedNoFee.push(`${s.user.firstName} ${s.user.lastName}`);
      continue;
    }
    if (alreadyCharged.has(s.id)) {
      skipped++;
      continue;
    }
    toCharge.push({ id: s.id, amount });
  }

  // One insert for all new charges, then recompute each affected student
  if (toCharge.length > 0) {
    await prisma.feeLedger.createMany({
      data: toCharge.map(t => ({
        studentId: t.id,
        month,
        type: 'CHARGE',
        category: 'MONTHLY_FEE',
        description: `Monthly Fee - ${monthLabel}`,
        amount: t.amount,
        balanceAfter: 0,
        date: safeDate,
      })),
    });
    for (const t of toCharge) {
      await recomputeStudentLedger(t.id);
    }
  }

  const charged = toCharge.length;
  const totalAmount = toCharge.reduce((s, t) => s + t.amount, 0);

  return Response.json({
    month,
    monthLabel,
    studentsCharged: charged,
    studentsSkipped: skipped,
    totalAmount,
    skippedNoFee: skippedNoFee.length ? skippedNoFee.slice(0, 10) : undefined,
  }, { status: 201 });
}
