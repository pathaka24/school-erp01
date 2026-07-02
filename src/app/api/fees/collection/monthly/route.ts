import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireScope } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

// GET /api/fees/collection/monthly?session=YYYY-YYYY&classId=
// Cash collected per calendar month (by payment date) for a session — the
// monthly collection register. Also billed per month and by payment method.
export async function GET(request: NextRequest) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const sp = request.nextUrl.searchParams;
  const session = sp.get('session');
  const classId = sp.get('classId');

  const now = new Date();
  const defStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  let start = defStart;
  if (session && /^\d{4}-\d{4}$/.test(session)) start = parseInt(session.split('-')[0], 10);

  const months: string[] = [];
  for (let m = 4; m <= 12; m++) months.push(`${start}-${String(m).padStart(2, '0')}`);
  for (let m = 1; m <= 3; m++) months.push(`${start + 1}-${String(m).padStart(2, '0')}`);
  const startDate = new Date(`${start}-04-01T00:00:00Z`);
  const endDate = new Date(`${start + 1}-04-01T00:00:00Z`);

  let studentIds: string[] | null = null;
  if (classId) {
    const s = await prisma.student.findMany({ where: { classId }, select: { id: true } });
    studentIds = s.map(x => x.id);
  }
  const idFilter = studentIds ? { studentId: { in: studentIds } } : {};

  // Cash received (by payment date)
  const deposits = await prisma.feeLedger.findMany({
    where: { type: 'DEPOSIT', voidedAt: null, archivedAt: null, date: { gte: startDate, lt: endDate }, ...idFilter },
    select: { date: true, amount: true, paymentMethod: true },
  });
  // Billed (by fee month) for context
  const chargeGroups = await prisma.feeLedger.groupBy({
    by: ['month'], where: { type: 'CHARGE', voidedAt: null, archivedAt: null, month: { in: months }, ...idFilter }, _sum: { amount: true },
  });
  const billedByMonth = new Map(chargeGroups.map(g => [g.month, g._sum.amount || 0]));

  const rowMap = new Map<string, { month: string; collected: number; deposits: number; billed: number }>();
  for (const m of months) rowMap.set(m, { month: m, collected: 0, deposits: 0, billed: billedByMonth.get(m) || 0 });
  const byMethod = new Map<string, { method: string; total: number; count: number }>();
  for (const d of deposits) {
    const ym = `${d.date.getUTCFullYear()}-${String(d.date.getUTCMonth() + 1).padStart(2, '0')}`;
    const r = rowMap.get(ym);
    if (r) { r.collected += d.amount; r.deposits += 1; }
    const mk = d.paymentMethod || 'UNSPECIFIED';
    const e = byMethod.get(mk) || { method: mk, total: 0, count: 0 };
    e.total += d.amount; e.count += 1; byMethod.set(mk, e);
  }

  const rows = months.map(m => rowMap.get(m)!);
  const totalCollected = rows.reduce((a, r) => a + r.collected, 0);
  const totalBilled = rows.reduce((a, r) => a + r.billed, 0);
  const totalDeposits = rows.reduce((a, r) => a + r.deposits, 0);

  return Response.json({
    session: `${start}-${start + 1}`,
    rows,
    byMethod: Array.from(byMethod.values()).sort((a, b) => b.total - a.total),
    totals: { collected: totalCollected, billed: totalBilled, deposits: totalDeposits },
  });
}
