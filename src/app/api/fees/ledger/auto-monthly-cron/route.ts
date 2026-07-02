import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { recomputeStudentLedger } from '@/lib/feeLedger';

// GET /api/fees/ledger/auto-monthly-cron
// Triggered by Vercel Cron on day 1 of each month (see web/vercel.json).
// Generates a MONTHLY_FEE charge for every student using their class's
// monthlyFee from the saved fee plan. Idempotent: skips students who
// already have one for the current month.
//
// Auth: if CRON_SECRET env var is set, requires `Authorization: Bearer <secret>`.
// Vercel Cron automatically sends this header when CRON_SECRET is configured
// in the project's env vars.
export async function GET(request: NextRequest) {
  if (process.env.CRON_SECRET) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const feePlanSetting = await prisma.schoolSettings.findUnique({ where: { key: 'feePlan' } });
  if (!feePlanSetting) {
    return Response.json({ error: 'Fee plan not configured' }, { status: 400 });
  }

  let plan: any;
  try { plan = JSON.parse(feePlanSetting.value); } catch {
    return Response.json({ error: 'Fee plan corrupted' }, { status: 500 });
  }

  const monthlyFeeByClass = new Map<string, number>();
  for (const c of plan?.classes || []) {
    const amount = Number(c.monthlyFee) || 0;
    if (amount > 0) monthlyFeeByClass.set(c.classId, amount);
  }

  if (monthlyFeeByClass.size === 0) {
    return Response.json({ ok: true, month, studentsCharged: 0, note: 'No classes have a monthly fee set' });
  }

  // Never auto-charge soft-deleted (deactivated) or fee-exempt students
  const students = await prisma.student.findMany({
    where: { user: { isActive: true }, feeExempt: false },
    select: { id: true, classId: true, monthlyFee: true },
  });

  const entryDate = new Date(month + '-01T00:00:00Z');
  const monthLabel = new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  let skipped = 0;

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
    // Per-student override wins; otherwise the class default
    const amount = s.monthlyFee != null && s.monthlyFee > 0 ? s.monthlyFee : monthlyFeeByClass.get(s.classId);
    if (!amount || alreadyCharged.has(s.id)) { skipped++; continue; }
    toCharge.push({ id: s.id, amount });
  }

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
        date: entryDate,
      })),
    });
    for (const t of toCharge) {
      await recomputeStudentLedger(t.id);
    }
  }

  const charged = toCharge.length;
  const totalAmount = toCharge.reduce((s, t) => s + t.amount, 0);

  return Response.json({
    ok: true,
    month,
    monthLabel,
    studentsCharged: charged,
    studentsSkipped: skipped,
    totalAmount,
    triggeredAt: now.toISOString(),
  });
}
