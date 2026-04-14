import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/monthly-report/class?classId=xxx&sectionId=xxx&month=2025-04&academicYear=2025-2026
// Returns diary data for ALL students in a class for one month
export async function GET(request: NextRequest) {
  const classId = request.nextUrl.searchParams.get('classId');
  const sectionId = request.nextUrl.searchParams.get('sectionId');
  const month = request.nextUrl.searchParams.get('month');
  const now = new Date();
  const defaultYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const academicYear = request.nextUrl.searchParams.get('academicYear') || `${defaultYear}-${defaultYear + 1}`;

  if (!classId || !month) {
    return Response.json({ error: 'classId and month required' }, { status: 400 });
  }

  const where: any = { classId };
  if (sectionId) where.sectionId = sectionId;

  const students = await prisma.student.findMany({
    where,
    include: {
      user: { select: { firstName: true, lastName: true } },
      section: { select: { name: true } },
    },
    orderBy: { user: { firstName: 'asc' } },
  });

  // ─── Scholarship Scheme ───
  // Annual ₹1200 (configurable) / 12 = ₹100/month
  // Attendance 10%, Test Marks 20%, Fee Balance 70%
  const feePlanSetting = await prisma.schoolSettings.findUnique({ where: { key: 'feePlan' } });
  let annualScholarship = 1200;
  let scholarshipWeights = { attendance: 10, testMarks: 20, feeBalance: 70 };
  let classMonthlyFee = 1000;
  if (feePlanSetting) {
    try {
      const plan = JSON.parse(feePlanSetting.value);
      if (plan.scholarshipWeights) scholarshipWeights = { ...scholarshipWeights, ...plan.scholarshipWeights };
      if (plan.annualScholarship != null) annualScholarship = plan.annualScholarship;
      const cp = plan.classes?.find((c: any) => c.classId === classId);
      if (cp) {
        classMonthlyFee = cp.monthlyFee || 1000;
        if (cp.annualScholarship != null) annualScholarship = cp.annualScholarship;
        if (cp.scholarshipWeights) scholarshipWeights = { ...scholarshipWeights, ...cp.scholarshipWeights };
      }
    } catch {}
  }
  const monthlyScholarship = Math.round(annualScholarship / 12);
  const wAtt = (scholarshipWeights.attendance || 10) / 100;
  const wTest = (scholarshipWeights.testMarks || 20) / 100;
  const wFee = (scholarshipWeights.feeBalance || 70) / 100;

  // Parse month range for attendance
  const [y, m] = month.split('-').map(Number);
  const monthStart = new Date(Date.UTC(y, m - 1, 1));
  const monthEnd = new Date(Date.UTC(y, m, 1));

  const studentIds = students.map(s => s.id);

  // For fee balance %, we need cumulative totals up to this month
  // Parse academic year to get all months up to current
  const [startYear] = academicYear.split('-').map(Number);
  const allMonths: string[] = [];
  for (let mo = 4; mo <= 12; mo++) allMonths.push(`${startYear}-${String(mo).padStart(2, '0')}`);
  for (let mo = 1; mo <= 3; mo++) allMonths.push(`${startYear + 1}-${String(mo).padStart(2, '0')}`);
  const monthsUpToCurrent = allMonths.slice(0, allMonths.indexOf(month) + 1);

  // Fetch all data in parallel
  const [attendances, grades, feeLedgerCurrent, feeLedgerCumulative, reports] = await Promise.all([
    prisma.attendance.findMany({
      where: { studentId: { in: studentIds }, date: { gte: monthStart, lt: monthEnd } },
      select: { studentId: true, status: true },
    }),
    prisma.grade.findMany({
      where: { studentId: { in: studentIds } },
      include: {
        examSubject: { include: { exam: { select: { startDate: true } } } },
      },
    }),
    // Current month fee entries (for hasLateFee detection)
    prisma.feeLedger.findMany({
      where: { studentId: { in: studentIds }, month },
    }),
    // All fee entries up to this month (for cumulative balance)
    prisma.feeLedger.findMany({
      where: { studentId: { in: studentIds }, month: { in: monthsUpToCurrent } },
    }),
    (prisma.monthlyReport as any).findMany({
      where: { studentId: { in: studentIds }, month },
    }),
  ]);

  // Group attendance by student
  const attByStudent = new Map<string, { total: number; present: number }>();
  for (const a of attendances) {
    if (!attByStudent.has(a.studentId)) attByStudent.set(a.studentId, { total: 0, present: 0 });
    const r = attByStudent.get(a.studentId)!;
    r.total++;
    if (a.status === 'PRESENT' || a.status === 'LATE') r.present++;
  }

  // Group grades by student (current month only)
  const gradesByStudent = new Map<string, { totalMarks: number; maxMarks: number }>();
  for (const g of grades) {
    if (!g.examSubject?.exam?.startDate) continue;
    const gMonth = `${g.examSubject.exam.startDate.getUTCFullYear()}-${String(g.examSubject.exam.startDate.getUTCMonth() + 1).padStart(2, '0')}`;
    if (gMonth !== month) continue;
    if (!gradesByStudent.has(g.studentId)) gradesByStudent.set(g.studentId, { totalMarks: 0, maxMarks: 0 });
    const r = gradesByStudent.get(g.studentId)!;
    r.totalMarks += g.marksObtained;
    r.maxMarks += g.examSubject.maxMarks;
  }

  // Current month fee data (for late fee detection)
  const feeCurrentByStudent = new Map<string, { monthlyFee: number; deposited: number; hasLateFee: boolean; lateFeeAmount: number }>();
  for (const entry of feeLedgerCurrent) {
    if (!feeCurrentByStudent.has(entry.studentId)) feeCurrentByStudent.set(entry.studentId, { monthlyFee: 0, deposited: 0, hasLateFee: false, lateFeeAmount: 0 });
    const r = feeCurrentByStudent.get(entry.studentId)!;
    if (entry.type === 'CHARGE' && entry.category === 'MONTHLY_FEE') r.monthlyFee += entry.amount;
    if (entry.type === 'CHARGE' && entry.category === 'LATE_FEE') { r.hasLateFee = true; r.lateFeeAmount += entry.amount; }
    if (entry.type === 'DEPOSIT') r.deposited += entry.amount;
  }

  // Build running balance per student up to this month
  // We need: balance BEFORE this month's deposits, and this month's deposit amount
  const balanceByStudent = new Map<string, { balanceBeforeDeposit: number; depositedThisMonth: number }>();
  for (const entry of feeLedgerCumulative) {
    if (!balanceByStudent.has(entry.studentId)) balanceByStudent.set(entry.studentId, { balanceBeforeDeposit: 0, depositedThisMonth: 0 });
    const r = balanceByStudent.get(entry.studentId)!;
    if (entry.month === month) {
      // Current month: charges add to balance, deposits tracked separately
      if (entry.type === 'CHARGE') r.balanceBeforeDeposit += entry.amount;
      if (entry.type === 'DEPOSIT') r.depositedThisMonth += entry.amount;
    } else {
      // Previous months: net balance
      if (entry.type === 'CHARGE') r.balanceBeforeDeposit += entry.amount;
      if (entry.type === 'DEPOSIT') r.balanceBeforeDeposit -= entry.amount;
    }
  }

  const reportMap = new Map(reports.map((r: any) => [r.studentId, r]));

  // Build per-student diary
  const diary = students.map(student => {
    const att = attByStudent.get(student.id);
    const gr = gradesByStudent.get(student.id);
    const feeCurrent = feeCurrentByStudent.get(student.id);
    const bal = balanceByStudent.get(student.id);
    const report: any = reportMap.get(student.id);

    const attendancePct = att && att.total > 0 ? Math.round((att.present / att.total) * 10000) / 100 : null;
    const testMarksPct = gr && gr.maxMarks > 0 ? Math.round((gr.totalMarks / gr.maxMarks) * 100) : null;

    // Fee scholarship: paid this month / balance before deposit
    const depositedThisMonth = bal?.depositedThisMonth || 0;
    const balanceBeforeDeposit = bal?.balanceBeforeDeposit || 0;
    let feeBalancePct: number;
    if (balanceBeforeDeposit <= 0) {
      feeBalancePct = 100; // no dues
    } else if (depositedThisMonth <= 0) {
      feeBalancePct = 0; // had balance, paid nothing
    } else {
      feeBalancePct = Math.min(Math.round((depositedThisMonth / balanceBeforeDeposit) * 100), 100);
    }

    const hasLateFee = feeCurrent?.hasLateFee || false;

    // Use overrides if set
    const finalAtt = report?.attendancePct ?? attendancePct;
    const finalTest = report?.testMarksPct ?? testMarksPct;
    const finalFee = report?.feeSubmissionPct ?? feeBalancePct;

    // Scholarship calculation: ₹100/month split by weights
    const attScore = finalAtt || 0;
    const testScore = finalTest || 0;
    const feeScore = finalFee || 0;

    const attAmount = Math.round((attScore / 100) * monthlyScholarship * wAtt * 100) / 100;
    const testAmount = Math.round((testScore / 100) * monthlyScholarship * wTest * 100) / 100;
    const feeAmt = Math.round((feeScore / 100) * monthlyScholarship * wFee * 100) / 100;
    const autoScholarship = Math.round(attAmount + testAmount + feeAmt);
    const scholarship = report?.rewardAmount ?? autoScholarship;
    const quizBonus = report?.quizBonus || 0;
    const grandTotal = scholarship + quizBonus;

    return {
      studentId: student.id,
      admissionNo: student.admissionNo,
      name: `${student.user.firstName} ${student.user.lastName}`,
      section: student.section?.name,
      attendancePct: finalAtt,
      testMarksPct: finalTest,
      feeBalancePct: finalFee,
      depositedThisMonth,
      balanceBeforeDeposit,
      hasLateFee,
      discipline: report?.discipline || null,
      comment: report?.comment || null,
      scholarship,
      autoScholarship,
      quizBonus,
      grandTotal,
      scholarshipBreakdown: {
        attAmount: Math.round(attAmount),
        testAmount: Math.round(testAmount),
        feeAmount: Math.round(feeAmt),
        autoTotal: autoScholarship,
        quizBonus,
        grandTotal,
        monthlyMax: monthlyScholarship,
      },
      reportId: report?.id || null,
    };
  });

  const totalScholarship = diary.reduce((s, d) => s + d.grandTotal, 0);

  return Response.json({
    month,
    academicYear,
    annualScholarship,
    monthlyScholarship,
    classMonthlyFee,
    weights: scholarshipWeights,
    students: diary,
    summary: {
      totalStudents: diary.length,
      totalScholarship,
    },
  });
}

// POST /api/monthly-report/class — bulk save diary for all students
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { month, academicYear, entries } = body as {
    month: string;
    academicYear: string;
    entries: { studentId: string; discipline?: string; comment?: string; rewardAmount?: number; quizBonus?: number; attendancePct?: number; testMarksPct?: number; feeSubmissionPct?: number }[];
  };

  if (!month || !academicYear || !entries?.length) {
    return Response.json({ error: 'month, academicYear, and entries required' }, { status: 400 });
  }

  let saved = 0;
  for (const entry of entries) {
    const data: any = {};
    if (entry.discipline !== undefined) data.discipline = entry.discipline || null;
    if (entry.comment !== undefined) data.comment = entry.comment || null;
    if (entry.rewardAmount !== undefined) data.rewardAmount = entry.rewardAmount;
    if (entry.quizBonus !== undefined) data.quizBonus = entry.quizBonus;
    if (entry.attendancePct !== undefined) data.attendancePct = entry.attendancePct;
    if (entry.testMarksPct !== undefined) data.testMarksPct = entry.testMarksPct;
    if (entry.feeSubmissionPct !== undefined) data.feeSubmissionPct = entry.feeSubmissionPct;

    if (Object.keys(data).length > 0) {
      await (prisma.monthlyReport as any).upsert({
        where: { studentId_month: { studentId: entry.studentId, month } },
        create: { studentId: entry.studentId, month, academicYear, ...data },
        update: data,
      });
      saved++;
    }
  }

  return Response.json({ saved, total: entries.length });
}
