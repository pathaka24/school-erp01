import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireScope } from '@/lib/apiAuth';

// Always compute live — never serve a cached snapshot (a void/edit elsewhere
// must show up immediately).
export const dynamic = 'force-dynamic';

// GET /api/fee-reports/ledger-finance
//
// School-wide fee finance computed ENTIRELY from the FeeLedger (the real book):
//   - Totals: billed (charges), collected (deposits), discounts, outstanding
//   - Collection rate
//   - Charges by category, collections by payment method
//   - Month-by-month billed vs collected
//   - Per-class billed / collected / discount / outstanding / collection %
//   - Student / defaulter / advance counts
export async function GET(request: NextRequest) {
  const auth = await requireScope(request, 'reports');
  if (auth instanceof Response) return auth;

  const base = { voidedAt: null as null, archivedAt: null as null };

  // ── Academic-year scope ────────────────────────────────────────────────
  // Activity metrics (billed/collected/discount/by-category/method/month/class)
  // are scoped to the selected academic year (Apr→Mar). Position metrics
  // (outstanding/advance/aging/counts) are an as-of-today snapshot, all-time.
  const now = new Date();
  const nowAY = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  const ayParam = parseInt(request.nextUrl.searchParams.get('ay') || '', 10);
  const ay = Number.isFinite(ayParam) ? ayParam : nowAY;
  const ayMonths: string[] = [];
  for (let m = 4; m <= 12; m++) ayMonths.push(`${ay}-${String(m).padStart(2, '0')}`);
  for (let m = 1; m <= 3; m++) ayMonths.push(`${ay + 1}-${String(m).padStart(2, '0')}`);
  const monthFilter = { month: { in: ayMonths } };
  // "YYYY-MM" strings sort lexicographically, so a string range = the AY window.
  const ayStart = `${ay}-04`;
  const ayEnd = `${ay + 1}-03`;

  // Which academic years have any ledger data (for the year picker)
  const monthsPresent = await prisma.feeLedger.findMany({ where: base, distinct: ['month'], select: { month: true } });
  const aySet = new Set<number>();
  for (const r of monthsPresent) { const [yy, mm] = r.month.split('-').map(Number); aySet.add(mm >= 4 ? yy : yy - 1); }
  aySet.add(nowAY);
  const availableYears = Array.from(aySet).sort((a, b) => b - a);

  const [chargedAgg, depositAgg, discountAgg, catRows, methodGroups, monthTypeGroups] = await Promise.all([
    prisma.feeLedger.aggregate({ where: { ...base, ...monthFilter, type: 'CHARGE' }, _sum: { amount: true }, _count: { id: true } }),
    prisma.feeLedger.aggregate({ where: { ...base, ...monthFilter, type: 'DEPOSIT' }, _sum: { amount: true }, _count: { id: true } }),
    prisma.feeLedger.aggregate({ where: { ...base, ...monthFilter, type: 'DISCOUNT' }, _sum: { amount: true }, _count: { id: true } }),
    // Per charge category: how many DISTINCT students bought it, quantity of items, total ₹
    prisma.$queryRaw<{ category: string | null; students: number; items: number; total: number }[]>`
      SELECT category,
             COUNT(DISTINCT "studentId")::int AS students,
             COUNT(*)::int AS items,
             SUM(amount)::float8 AS total
      FROM "fee_ledger"
      WHERE "voidedAt" IS NULL AND "archivedAt" IS NULL AND type = 'CHARGE' AND month >= ${ayStart} AND month <= ${ayEnd}
      GROUP BY category
    `,
    prisma.feeLedger.groupBy({ by: ['paymentMethod'], where: { ...base, ...monthFilter, type: 'DEPOSIT' }, _sum: { amount: true }, _count: { id: true } }),
    prisma.feeLedger.groupBy({ by: ['month', 'type'], where: { ...base, ...monthFilter }, _sum: { amount: true } }),
  ]);

  const totalBilled = chargedAgg._sum.amount || 0;
  const totalCollected = depositAgg._sum.amount || 0;
  const totalDiscount = discountAgg._sum.amount || 0;

  // Scholarships are DISCOUNT entries with category SCHOLARSHIP (a subset of discounts)
  const scholarshipAgg = await prisma.feeLedger.aggregate({
    where: { ...base, type: 'DISCOUNT', category: 'SCHOLARSHIP' },
    _sum: { amount: true }, _count: { id: true },
  });
  const totalScholarship = scholarshipAgg._sum.amount || 0;

  // Outstanding = latest non-voided balance per student
  const outstandingRows = await prisma.$queryRaw<{ studentId: string; balanceAfter: number }[]>`
    SELECT DISTINCT ON ("studentId") "studentId", "balanceAfter"
    FROM "fee_ledger"
    WHERE "voidedAt" IS NULL AND "archivedAt" IS NULL
    ORDER BY "studentId", "date" DESC, "createdAt" DESC, "id" DESC
  `;
  const totalOutstanding = outstandingRows.reduce((s, r) => s + Math.max(0, r.balanceAfter), 0);
  const totalAdvance = outstandingRows.reduce((s, r) => s + Math.max(0, -r.balanceAfter), 0);
  const defaulterCount = outstandingRows.filter(r => r.balanceAfter > 0.5).length;
  const advanceCount = outstandingRows.filter(r => r.balanceAfter < -0.5).length;
  const clearCount = outstandingRows.filter(r => Math.abs(r.balanceAfter) <= 0.5).length;

  // Per-class billed / collected / discount via a join
  const classAgg = await prisma.$queryRaw<{ classId: string; name: string; type: string; total: number }[]>`
    SELECT c.id AS "classId", c.name AS name, fl.type AS type, SUM(fl.amount)::float8 AS total
    FROM "fee_ledger" fl
    JOIN "students" s ON s.id = fl."studentId"
    JOIN "classes" c ON c.id = s."classId"
    WHERE fl."voidedAt" IS NULL AND fl."archivedAt" IS NULL AND fl.month >= ${ayStart} AND fl.month <= ${ayEnd}
    GROUP BY c.id, c.name, fl.type
  `;
  // Per-class outstanding from latest balances + student→class map
  const studentClass = await prisma.student.findMany({ select: { id: true, classId: true, class: { select: { name: true } } } });
  const classOf = new Map(studentClass.map(s => [s.id, { id: s.classId, name: s.class?.name || '—' }]));

  const classMap = new Map<string, { name: string; billed: number; collected: number; discount: number; outstanding: number }>();
  const ensureClass = (id: string, name: string) => {
    if (!classMap.has(id)) classMap.set(id, { name, billed: 0, collected: 0, discount: 0, outstanding: 0 });
    return classMap.get(id)!;
  };
  for (const r of classAgg) {
    const c = ensureClass(r.classId, r.name);
    if (r.type === 'CHARGE') c.billed += r.total;
    else if (r.type === 'DEPOSIT') c.collected += r.total;
    else if (r.type === 'DISCOUNT') c.discount += r.total;
  }
  for (const r of outstandingRows) {
    const cl = classOf.get(r.studentId);
    if (!cl) continue;
    const c = ensureClass(cl.id, cl.name);
    c.outstanding += Math.max(0, r.balanceAfter);
  }
  const byClass = Array.from(classMap.values())
    .map(c => ({ ...c, collectionRate: c.billed > 0 ? Math.round(((c.collected + c.discount) / c.billed) * 100) : 0 }))
    .sort((a, b) => b.outstanding - a.outstanding);

  // Month-by-month billed vs collected — seed all 12 AY months so the chart is complete
  const monthMap = new Map<string, { month: string; billed: number; collected: number; discount: number }>();
  for (const mo of ayMonths) monthMap.set(mo, { month: mo, billed: 0, collected: 0, discount: 0 });
  for (const g of monthTypeGroups) {
    if (!monthMap.has(g.month)) monthMap.set(g.month, { month: g.month, billed: 0, collected: 0, discount: 0 });
    const m = monthMap.get(g.month)!;
    const amt = g._sum.amount || 0;
    if (g.type === 'CHARGE') m.billed += amt;
    else if (g.type === 'DEPOSIT') m.collected += amt;
    else if (g.type === 'DISCOUNT') m.discount += amt;
  }
  const byMonth = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));

  // ── Outstanding aging (as-of-today, all-time) ──────────────────────────
  // Each unpaid CHARGE bucketed by how many months old it is vs the current month.
  const dueCharges = await prisma.feeLedger.findMany({
    where: { ...base, type: 'CHARGE' },
    select: { month: true, amount: true, paidAmount: true },
  });
  const curIdx = now.getFullYear() * 12 + now.getMonth();
  const aging = { current: 0, m1: 0, m23: 0, m4plus: 0 };
  for (const c of dueCharges) {
    const due = c.amount - c.paidAmount;
    if (due <= 0.5) continue;
    const [yy, mm] = c.month.split('-').map(Number);
    const age = curIdx - (yy * 12 + (mm - 1));
    if (age <= 0) aging.current += due;
    else if (age === 1) aging.m1 += due;
    else if (age <= 3) aging.m23 += due;
    else aging.m4plus += due;
  }

  const CAT_LABELS: Record<string, string> = {
    MONTHLY_FEE: 'Monthly Fee', ANNUAL: 'Annual', ADMISSION: 'Admission', REGISTRATION: 'Registration',
    BOOK: 'Books', DRESS: 'Dress', COPY: 'Copy', DAIRY: 'Dairy', TIE_BELT: 'Tie / Belt', TRANSPORT: 'Transport',
    EXAM_FEE: 'Exam Fee', FINE: 'Fine', LATE_FEE: 'Late Fee', ID_CARD: 'ID Card', PREVIOUS_BALANCE: 'Previous Balance', AD_HOC: 'Other',
  };
  const byCategory = catRows
    .map(g => ({
      category: g.category || 'AD_HOC',
      label: CAT_LABELS[g.category || 'AD_HOC'] || (g.category || 'Other'),
      total: g.total || 0,
      students: g.students || 0, // distinct kids who bought/were charged this
      items: g.items || 0,        // quantity of charge entries
    }))
    .sort((a, b) => b.total - a.total);

  const byMethod = methodGroups
    .map(g => ({ method: g.paymentMethod || 'UNSPECIFIED', total: g._sum.amount || 0, count: g._count.id }))
    .sort((a, b) => b.total - a.total);

  return Response.json({
    totals: {
      billed: totalBilled,
      collected: totalCollected,
      discount: totalDiscount,
      scholarship: totalScholarship,
      scholarshipCount: scholarshipAgg._count.id,
      outstanding: totalOutstanding,
      advance: totalAdvance,
      // (collected + discount) / billed — how much of what's owed has been settled
      collectionRate: totalBilled > 0 ? Math.round(((totalCollected + totalDiscount) / totalBilled) * 100) : 0,
      chargeCount: chargedAgg._count.id,
      depositCount: depositAgg._count.id,
      discountCount: discountAgg._count.id,
    },
    counts: { students: outstandingRows.length, defaulters: defaulterCount, advance: advanceCount, clear: clearCount },
    aging,
    ay,
    availableYears,
    byCategory,
    byMethod,
    byMonth,
    byClass,
  });
}
