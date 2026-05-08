import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/fees/register?classId=...&sectionId=...&month=YYYY-MM
// Returns all students in the class/section with their existing ledger entries
// for that month + the class's monthly fee from the saved plan. Used by the
// register-style row-by-row entry page.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const classId = sp.get('classId');
  const sectionId = sp.get('sectionId');
  const month = sp.get('month');

  if (!classId || !month || !/^\d{4}-\d{2}$/.test(month)) {
    return Response.json({ error: 'classId and month (YYYY-MM) are required' }, { status: 400 });
  }

  const studentWhere: any = { classId };
  if (sectionId) studentWhere.sectionId = sectionId;

  const students = await prisma.student.findMany({
    where: studentWhere,
    include: {
      user: { select: { firstName: true, lastName: true } },
      section: { select: { id: true, name: true } },
    },
    orderBy: [{ rollNumber: 'asc' }, { admissionNo: 'asc' }],
  });

  if (students.length === 0) {
    return Response.json({ students: [], monthlyFee: 0 });
  }

  // Per-class monthly fee from the saved plan
  const feePlanSetting = await prisma.schoolSettings.findUnique({ where: { key: 'feePlan' } });
  let monthlyFee = 0;
  if (feePlanSetting) {
    try {
      const plan = JSON.parse(feePlanSetting.value);
      const classPlan = plan?.classes?.find((c: any) => c.classId === classId);
      monthlyFee = Number(classPlan?.monthlyFee) || 0;
    } catch {}
  }

  const studentIds = students.map(s => s.id);

  // Existing entries for the requested month (excluding voided)
  const monthEntries = await prisma.feeLedger.findMany({
    where: { studentId: { in: studentIds }, month, voidedAt: null },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });

  // Latest balance per student (use latest non-voided entry across all months)
  const latestPerStudent = await prisma.feeLedger.findMany({
    where: { studentId: { in: studentIds }, voidedAt: null },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    distinct: ['studentId'],
    select: { studentId: true, balanceAfter: true },
  });
  const balanceMap = new Map<string, number>();
  for (const e of latestPerStudent) balanceMap.set(e.studentId, e.balanceAfter);

  const rows = students.map(s => {
    const entries = monthEntries.filter(e => e.studentId === s.id);
    const monthlyEntry = entries.find(e => e.type === 'CHARGE' && e.category === 'MONTHLY_FEE') || null;
    const otherCharges = entries.filter(e => e.type === 'CHARGE' && e.category !== 'MONTHLY_FEE');
    const deposits = entries.filter(e => e.type === 'DEPOSIT');
    return {
      studentId: s.id,
      admissionNo: s.admissionNo,
      rollNumber: s.rollNumber,
      name: `${s.user.firstName} ${s.user.lastName}`.trim(),
      sectionName: s.section?.name,
      currentBalance: balanceMap.get(s.id) ?? 0,
      monthlyFeeEntryId: monthlyEntry?.id || null,
      monthlyFeeAmount: monthlyEntry?.amount ?? null,
      otherCharges: otherCharges.map(e => ({ id: e.id, category: e.category, description: e.description, amount: e.amount })),
      deposits: deposits.map(e => ({ id: e.id, amount: e.amount, paymentMethod: e.paymentMethod, receivedBy: e.receivedBy, receiptNumber: e.receiptNumber })),
    };
  });

  return Response.json({ students: rows, monthlyFee, month });
}
