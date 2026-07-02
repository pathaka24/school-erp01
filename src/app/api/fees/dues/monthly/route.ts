import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireScope } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

// GET /api/fees/dues/monthly?month=YYYY-MM&classId=&sectionId=&status=&search=
//
// Month-wise dues: for the selected fee month, each student's charge total,
// how much is paid (FIFO paidAmount), outstanding, due date and status.
// Also returns `pendingGeneration` — active students who don't yet have that
// month's monthly fee (so the UI can offer "Generate <month> fees").
export async function GET(request: NextRequest) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const sp = request.nextUrl.searchParams;
  const month = sp.get('month');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return Response.json({ error: 'month is required (YYYY-MM)' }, { status: 400 });
  }
  const classId = sp.get('classId');
  const sectionId = sp.get('sectionId');
  const statusFilter = (sp.get('status') || '').toUpperCase(); // PAID | PARTIAL | UNPAID | OVERDUE
  const search = (sp.get('search') || '').trim();

  // Fee due day (school-wide), default 10th
  const dueSetting = await prisma.schoolSettings.findUnique({ where: { key: 'feeDueDay' } });
  let dueDay = 10;
  if (dueSetting) {
    let v: any = dueSetting.value;
    try { v = JSON.parse(dueSetting.value); } catch {}
    const n = Number(v);
    if (n >= 1 && n <= 28) dueDay = n;
  }
  const dueDate = new Date(`${month}-${String(dueDay).padStart(2, '0')}T00:00:00`);
  const now = new Date();
  const isPastDue = now > dueDate;
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Students in scope
  const studentWhere: any = { user: { isActive: true } };
  if (classId) studentWhere.classId = classId;
  if (sectionId) studentWhere.sectionId = sectionId;
  if (search) {
    studentWhere.OR = [
      { user: { firstName: { contains: search, mode: 'insensitive' } } },
      { user: { lastName: { contains: search, mode: 'insensitive' } } },
      { admissionNo: { contains: search, mode: 'insensitive' } },
    ];
  }
  const students = await prisma.student.findMany({
    where: studentWhere,
    select: {
      id: true, admissionNo: true, rollNumber: true, monthlyFee: true, feeExempt: true, classId: true,
      user: { select: { firstName: true, lastName: true } },
      class: { select: { name: true } },
      section: { select: { name: true } },
    },
  });
  const ids = students.map(s => s.id);

  // That month's charges (monthly fee + any other charges billed for the month)
  const charges = ids.length === 0 ? [] : await prisma.feeLedger.findMany({
    where: { studentId: { in: ids }, month, type: 'CHARGE', voidedAt: null, archivedAt: null },
    select: { studentId: true, amount: true, paidAmount: true, category: true },
  });
  const agg = new Map<string, { total: number; paid: number; hasMonthly: boolean }>();
  for (const c of charges) {
    const e = agg.get(c.studentId) || { total: 0, paid: 0, hasMonthly: false };
    e.total += c.amount;
    e.paid += c.paidAmount;
    if (c.category === 'MONTHLY_FEE') e.hasMonthly = true;
    agg.set(c.studentId, e);
  }

  // Class defaults (for "pending generation" — who still needs a monthly fee)
  const planSetting = await prisma.schoolSettings.findUnique({ where: { key: 'feePlan' } });
  const classDefault = new Map<string, number>();
  if (planSetting) {
    try {
      const plan = JSON.parse(planSetting.value);
      for (const c of plan?.classes || []) { const a = Number(c.monthlyFee) || 0; if (a > 0) classDefault.set(c.classId, a); }
    } catch {}
  }
  // Existing MONTHLY_FEE for the month (voided or not) — so deliberate voids aren't "pending"
  const existingMonthly = ids.length === 0 ? [] : await prisma.feeLedger.findMany({
    where: { studentId: { in: ids }, month, type: 'CHARGE', category: 'MONTHLY_FEE' },
    select: { studentId: true },
  });
  const hasMonthlyEver = new Set(existingMonthly.map(e => e.studentId));

  let pendingGeneration = 0;
  const rows: any[] = [];
  let totalBilled = 0, totalCollected = 0, totalOutstanding = 0, studentsWithDues = 0;

  for (const s of students) {
    const a = agg.get(s.id);
    // Pending generation: active, not exempt, has an effective fee, but no monthly fee row this month
    const effFee = s.feeExempt ? 0 : (s.monthlyFee != null && s.monthlyFee > 0 ? s.monthlyFee : classDefault.get(s.classId) || 0);
    if (!s.feeExempt && effFee > 0 && !hasMonthlyEver.has(s.id) && month <= curMonth) pendingGeneration++;

    if (!a || a.total <= 0) continue; // no fee billed this month → not in the report
    const total = a.total;
    const paid = Math.min(a.paid, total);
    const outstanding = Math.max(0, total - paid);
    let status: string;
    if (outstanding <= 0.5) status = 'PAID';
    else if (isPastDue) status = 'OVERDUE';
    else if (paid > 0.5) status = 'PARTIAL';
    else status = 'UNPAID';

    totalBilled += total;
    totalCollected += paid;
    totalOutstanding += outstanding;
    if (outstanding > 0.5) studentsWithDues++;

    rows.push({
      studentId: s.id,
      name: `${s.user.firstName} ${s.user.lastName}`.trim(),
      admissionNo: s.admissionNo,
      rollNumber: s.rollNumber,
      className: s.class?.name || '',
      sectionName: s.section?.name || '',
      feeMonth: month,
      totalFee: total,
      paid,
      outstanding,
      dueDate: dueDate.toISOString(),
      status,
    });
  }

  let filtered = rows;
  if (['PAID', 'PARTIAL', 'UNPAID', 'OVERDUE'].includes(statusFilter)) filtered = rows.filter(r => r.status === statusFilter);
  filtered.sort((a, b) => b.outstanding - a.outstanding || b.totalFee - a.totalFee);

  return Response.json({
    month,
    dueDate: dueDate.toISOString(),
    dueDay,
    pendingGeneration,
    rows: filtered,
    summary: {
      studentsWithDues,
      totalBilled,
      totalCollected,
      totalOutstanding,
      totalPending: totalOutstanding,
      count: rows.length,
    },
  });
}
