import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { recomputeStudentLedger } from '@/lib/feeLedger';

// Cache the parsed fee plan for the duration of one request to avoid
// re-parsing JSON for each student in family view.
let feePlanCache: { value: any; loadedAt: number } | null = null;
async function getFeePlan() {
  // Refresh every 30s — admin edits to the plan should pick up quickly
  if (feePlanCache && Date.now() - feePlanCache.loadedAt < 30_000) return feePlanCache.value;
  const setting = await prisma.schoolSettings.findUnique({ where: { key: 'feePlan' } });
  let plan: any = null;
  if (setting) { try { plan = JSON.parse(setting.value); } catch {} }
  feePlanCache = { value: plan, loadedAt: Date.now() };
  return plan;
}

// Ensure the current month has a MONTHLY_FEE charge for this student.
// Idempotent: skips if already present, no-ops if class has no fee plan.
async function ensureCurrentMonthFee(studentId: string, classId: string) {
  const plan = await getFeePlan();
  const classPlan = plan?.classes?.find((c: any) => c.classId === classId);
  const monthlyFee = Number(classPlan?.monthlyFee) || 0;
  if (monthlyFee <= 0) return;

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const existing = await prisma.feeLedger.findFirst({
    where: { studentId, month, type: 'CHARGE', category: 'MONTHLY_FEE', voidedAt: null },
    select: { id: true },
  });
  if (existing) return;

  const monthLabel = new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const entryDate = new Date(month + '-01T00:00:00Z');

  try {
    await prisma.feeLedger.create({
      data: {
        studentId, month, date: entryDate,
        type: 'CHARGE', category: 'MONTHLY_FEE',
        description: `Monthly Fee - ${monthLabel}`,
        amount: monthlyFee, balanceAfter: 0,
      },
    });
    await recomputeStudentLedger(studentId);
  } catch {
    // Race condition: another concurrent fetch beat us to it. Safe to ignore.
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  const familyView = request.nextUrl.searchParams.get('family') === 'true';

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: { select: { firstName: true, lastName: true, phone: true } },
      class: { select: { id: true, name: true } },
      section: { select: { name: true } },
      family: { include: { students: { include: { user: { select: { firstName: true, lastName: true } }, class: { select: { id: true, name: true } } } } } },
    },
  });
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });

  // Auto-add the current month's monthly fee if missing — for this student
  // and (in family view) any siblings as well. Idempotent; cheap if no-op.
  await ensureCurrentMonthFee(student.id, student.classId);
  if (familyView && student.family) {
    for (const sib of student.family.students) {
      if (sib.id !== student.id) {
        await ensureCurrentMonthFee(sib.id, sib.class.id);
      }
    }
  }

  // Get student IDs to query — just this student, or all siblings
  const studentIds = familyView && student.family
    ? student.family.students.map((s: any) => s.id)
    : [studentId];

  const includeVoided = request.nextUrl.searchParams.get('includeVoided') === 'true';

  const entries = await prisma.feeLedger.findMany({
    where: {
      studentId: { in: studentIds },
      ...(includeVoided ? {} : { voidedAt: null }),
    },
    include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });

  // Build monthly summary (like the physical register)
  const monthMap = new Map<string, {
    month: string;
    monthlyFee: number;
    otherCharges: number;
    otherDetails: string[];
    totalDue: number;
    deposited: number;
    balance: number;
    depositDates: string[];
    depositMethods: string[];
    receiptNumbers: string[];
  }>();

  let runningBalance = 0;
  for (const entry of entries) {
    const month = entry.month;
    if (!monthMap.has(month)) {
      monthMap.set(month, {
        month,
        monthlyFee: 0,
        otherCharges: 0,
        otherDetails: [],
        totalDue: 0,
        deposited: 0,
        balance: 0,
        depositDates: [],
        depositMethods: [],
        receiptNumbers: [],
      });
    }
    const row = monthMap.get(month)!;

    if (entry.type === 'CHARGE') {
      if (entry.category === 'MONTHLY_FEE') {
        row.monthlyFee += entry.amount;
      } else {
        row.otherCharges += entry.amount;
        row.otherDetails.push(`${entry.description}: ₹${entry.amount}`);
      }
      runningBalance += entry.amount;
    } else if (entry.type === 'DEPOSIT') {
      row.deposited += entry.amount;
      if (entry.date) row.depositDates.push(entry.date.toISOString());
      if (entry.paymentMethod) row.depositMethods.push(entry.paymentMethod);
      if (entry.receiptNumber) row.receiptNumbers.push(entry.receiptNumber);
      runningBalance -= entry.amount;
    }

    row.totalDue = runningBalance + row.deposited; // total before deposit
    row.balance = runningBalance;
  }

  // Current balance
  const currentBalance = runningBalance;

  // Compute totals
  const ledgerRows = Array.from(monthMap.values());
  const totals = {
    totalMonthlyFees: ledgerRows.reduce((s, r) => s + r.monthlyFee, 0),
    totalOtherCharges: ledgerRows.reduce((s, r) => s + r.otherCharges, 0),
    totalCharged: 0,
    totalDeposited: ledgerRows.reduce((s, r) => s + r.deposited, 0),
  };
  totals.totalCharged = totals.totalMonthlyFees + totals.totalOtherCharges;

  // Siblings info for family view
  const siblings = student.family
    ? student.family.students.map((s: any) => ({
        id: s.id,
        name: `${s.user.firstName} ${s.user.lastName}`,
        class: s.class?.name,
        admissionNo: '',
      }))
    : [];

  // Get admission numbers for siblings
  if (student.family) {
    const siblingDetails = await prisma.student.findMany({
      where: { id: { in: siblings.map(s => s.id) } },
      select: { id: true, admissionNo: true },
    });
    for (const sd of siblingDetails) {
      const sib = siblings.find(s => s.id === sd.id);
      if (sib) sib.admissionNo = sd.admissionNo;
    }
  }

  return Response.json({
    student: {
      id: student.id,
      name: `${student.user.firstName} ${student.user.lastName}`,
      class: student.class?.name,
      section: student.section?.name,
      admissionNo: student.admissionNo,
      familyId: student.familyId,
      familyName: student.family?.name,
    },
    siblings,
    currentBalance,
    totals,
    ledger: ledgerRows,
    entries, // raw entries for detailed view
  });
}
