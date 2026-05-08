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

  const students = await prisma.student.findMany({
    select: { id: true, classId: true },
  });

  const entryDate = new Date(month + '-01T00:00:00Z');
  const monthLabel = new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  let charged = 0;
  let skipped = 0;
  let totalAmount = 0;

  for (const s of students) {
    const amount = monthlyFeeByClass.get(s.classId);
    if (!amount) { skipped++; continue; }

    const existing = await prisma.feeLedger.findFirst({
      where: { studentId: s.id, month, type: 'CHARGE', category: 'MONTHLY_FEE', voidedAt: null },
      select: { id: true },
    });
    if (existing) { skipped++; continue; }

    await prisma.feeLedger.create({
      data: {
        studentId: s.id,
        month,
        type: 'CHARGE',
        category: 'MONTHLY_FEE',
        description: `Monthly Fee - ${monthLabel}`,
        amount,
        balanceAfter: 0,
        date: entryDate,
      },
    });
    await recomputeStudentLedger(s.id);

    charged++;
    totalAmount += amount;
  }

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
