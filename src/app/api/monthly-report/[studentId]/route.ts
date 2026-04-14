import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  const now = new Date();
  const defaultYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const academicYear = request.nextUrl.searchParams.get('academicYear') || `${defaultYear}-${defaultYear + 1}`;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: { select: { firstName: true, lastName: true } },
      class: { select: { id: true, name: true } },
      section: { select: { name: true } },
      family: { include: { students: { include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } } } },
    },
  });
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });

  // Parse academic year → months April to March
  const [startYear] = academicYear.split('-').map(Number);
  const months: string[] = [];
  for (let m = 4; m <= 12; m++) months.push(`${startYear}-${String(m).padStart(2, '0')}`);
  for (let m = 1; m <= 3; m++) months.push(`${startYear + 1}-${String(m).padStart(2, '0')}`);

  // ─── Scholarship Scheme ───
  // Annual scholarship amount (default ₹1200) divided into 12 months = ₹100/month
  // 3 components: Attendance 10%, Test Marks 20%, Fee Balance 70%
  // Fee balance = cumulative % paid of total charged (running balance based)
  const feePlanSetting = await prisma.schoolSettings.findUnique({ where: { key: 'feePlan' } });
  let annualScholarship = 1200;
  let scholarshipWeights = { attendance: 10, testMarks: 20, feeBalance: 70 };
  let classMonthlyFee = 1000;
  if (feePlanSetting) {
    try {
      const plan = JSON.parse(feePlanSetting.value);
      if (plan.scholarshipWeights) scholarshipWeights = { ...scholarshipWeights, ...plan.scholarshipWeights };
      if (plan.annualScholarship != null) annualScholarship = plan.annualScholarship;
      const cp = plan.classes?.find((c: any) => c.classId === student.classId);
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

  // Fetch all data in parallel
  const [attendances, grades, feeLedger, monthlyReports, exams] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        studentId,
        date: { gte: new Date(`${startYear}-04-01`), lt: new Date(`${startYear + 1}-04-01`) },
      },
      select: { date: true, status: true },
    }),
    prisma.grade.findMany({
      where: { studentId },
      include: {
        examSubject: {
          include: {
            exam: { select: { name: true, type: true, classId: true, startDate: true } },
            subject: { select: { name: true } },
          },
        },
      },
    }),
    prisma.feeLedger.findMany({
      where: { studentId, month: { in: months } },
      orderBy: { date: 'asc' },
    }),
    prisma.monthlyReport.findMany({
      where: { studentId, academicYear },
    }),
    prisma.exam.findMany({
      where: {
        classId: student.classId,
        startDate: { gte: new Date(`${startYear}-04-01`), lt: new Date(`${startYear + 1}-04-01`) },
      },
      select: { id: true, name: true, type: true, startDate: true },
    }),
  ]);

  // Helper: extract YYYY-MM from a Date without timezone shift
  const toMonth = (d: Date) => {
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
  };

  // Group attendance by month
  const attendanceByMonth: Record<string, { total: number; present: number; absent: number; late: number }> = {};
  for (const a of attendances) {
    const m = toMonth(a.date);
    if (!attendanceByMonth[m]) attendanceByMonth[m] = { total: 0, present: 0, absent: 0, late: 0 };
    attendanceByMonth[m].total++;
    if (a.status === 'PRESENT') attendanceByMonth[m].present++;
    else if (a.status === 'ABSENT') attendanceByMonth[m].absent++;
    else if (a.status === 'LATE') attendanceByMonth[m].late++;
  }

  // Group grades by month (based on exam start date)
  const gradesByMonth: Record<string, { totalMarks: number; maxMarks: number; exams: string[] }> = {};
  for (const g of grades) {
    if (!g.examSubject?.exam?.startDate) continue;
    const m = toMonth(g.examSubject.exam.startDate);
    if (!months.includes(m)) continue;
    if (!gradesByMonth[m]) gradesByMonth[m] = { totalMarks: 0, maxMarks: 0, exams: [] };
    gradesByMonth[m].totalMarks += g.marksObtained;
    gradesByMonth[m].maxMarks += g.examSubject.maxMarks;
    const examName = g.examSubject.exam.name;
    if (!gradesByMonth[m].exams.includes(examName)) gradesByMonth[m].exams.push(examName);
  }

  // Group fee ledger by month
  const feeByMonth: Record<string, { monthlyFee: number; otherCharges: number; deposited: number; balance: number; hasLateFee: boolean; lateFeeAmount: number }> = {};
  for (const entry of feeLedger) {
    if (!feeByMonth[entry.month]) feeByMonth[entry.month] = { monthlyFee: 0, otherCharges: 0, deposited: 0, balance: 0, hasLateFee: false, lateFeeAmount: 0 };
    if (entry.type === 'CHARGE') {
      if (entry.category === 'MONTHLY_FEE') {
        feeByMonth[entry.month].monthlyFee += entry.amount;
      } else if (entry.category === 'LATE_FEE') {
        feeByMonth[entry.month].hasLateFee = true;
        feeByMonth[entry.month].lateFeeAmount += entry.amount;
        feeByMonth[entry.month].otherCharges += entry.amount;
      } else {
        feeByMonth[entry.month].otherCharges += entry.amount;
      }
    } else if (entry.type === 'DEPOSIT') {
      feeByMonth[entry.month].deposited += entry.amount;
    }
    feeByMonth[entry.month].balance = entry.balanceAfter;
  }

  // Calculate running balance per month
  // Balance BEFORE deposit = previous balance + this month's charges
  // This is needed for fee scholarship: paid / balanceBeforeDeposit
  let runningBal = 0;
  const cumulativeByMonth: Record<string, { totalCharged: number; totalDeposited: number; balance: number; balanceBeforeDeposit: number; depositedThisMonth: number }> = {};
  for (const month of months) {
    const fee = feeByMonth[month];
    const chargesThisMonth = fee ? fee.monthlyFee + fee.otherCharges : 0;
    const depositedThisMonth = fee ? fee.deposited : 0;
    // Balance before any deposit this month = previous running + new charges
    const balanceBeforeDeposit = runningBal + chargesThisMonth;
    // After deposit
    runningBal = balanceBeforeDeposit - depositedThisMonth;
    cumulativeByMonth[month] = {
      totalCharged: chargesThisMonth,
      totalDeposited: depositedThisMonth,
      balance: runningBal,
      balanceBeforeDeposit,
      depositedThisMonth,
    };
  }

  // Monthly reports map
  const reportMap = new Map(monthlyReports.map((r: any) => [r.month, r]));

  // Build monthly diary entries
  const diary = months.map(month => {
    const att = attendanceByMonth[month];
    const gr = gradesByMonth[month];
    const fee = feeByMonth[month];
    const report: any = reportMap.get(month);
    const cumulative = cumulativeByMonth[month];

    const attendancePct = att && att.total > 0
      ? Math.round(((att.present + att.late) / att.total) * 100 * 100) / 100
      : null;

    const testMarksPct = gr && gr.maxMarks > 0
      ? Math.round((gr.totalMarks / gr.maxMarks) * 100)
      : null;

    // Fee scholarship logic:
    // - Paid something this month → fee% = (depositedThisMonth / balanceBeforeDeposit) × 100
    // - Paid nothing this month → fee% = 0 (no fee scholarship)
    // - No balance (₹0 dues) → 100% (fully cleared)
    const depositedThisMonth = cumulative?.depositedThisMonth || 0;
    const balanceBeforeDeposit = cumulative?.balanceBeforeDeposit || 0;
    let feeBalancePct: number;
    if (balanceBeforeDeposit <= 0) {
      // No dues at all — full score
      feeBalancePct = 100;
    } else if (depositedThisMonth <= 0) {
      // Had balance but paid nothing — 0%
      feeBalancePct = 0;
    } else {
      // Paid something — % of balance cleared
      feeBalancePct = Math.min(Math.round((depositedThisMonth / balanceBeforeDeposit) * 100), 100);
    }

    const hasLateFee = fee?.hasLateFee || false;
    const lateFeeAmount = fee?.lateFeeAmount || 0;

    const monthDate = new Date(month + '-01');
    const isHoliday = month === `${startYear}-06`;

    // Use manual overrides from report if set, otherwise auto-calculated
    const finalAttendance = report?.attendancePct != null ? report.attendancePct : attendancePct;
    const finalTestMarks = report?.testMarksPct != null ? report.testMarksPct : testMarksPct;
    const finalFeeBalancePct = report?.feeSubmissionPct != null ? report.feeSubmissionPct : feeBalancePct;
    const finalFeeAmount = report?.feeAmount != null ? report.feeAmount : depositedThisMonth;
    const finalHoliday = report?.isHoliday || (isHoliday && !att?.total);

    // ─── Monthly Scholarship Calculation ───
    // Annual = ₹1200 (configurable), Monthly = ₹100
    // Attendance: 10% of ₹100 = ₹10 max
    // Test Marks: 20% of ₹100 = ₹20 max
    // Fee: 70% of ₹100 = ₹70 max
    //   Based on this month's payment vs outstanding balance
    //   Paid ₹40 of ₹100 balance → 40% → ₹28
    //   Paid nothing → 0% → ₹0
    const attScore = finalHoliday ? 50 : (finalAttendance || 0);
    const testScore = finalTestMarks || 0;
    const feeScore = finalFeeBalancePct || 0;

    const attAmount = Math.round((attScore / 100) * monthlyScholarship * wAtt * 100) / 100;
    const testAmount = Math.round((testScore / 100) * monthlyScholarship * wTest * 100) / 100;
    const feeAmount = Math.round((feeScore / 100) * monthlyScholarship * wFee * 100) / 100;
    const autoReward = Math.round(attAmount + testAmount + feeAmount);
    const quizBonus = report?.quizBonus || 0;
    const rewardAmount = report?.rewardAmount != null ? report.rewardAmount : autoReward;
    const grandTotal = rewardAmount + quizBonus;

    return {
      month,
      monthName: monthDate.toLocaleDateString('en-IN', { month: 'long' }),
      year: monthDate.getFullYear(),
      auto: {
        attendancePct,
        testMarksPct,
        feeBalancePct,
        feeAmount: fee?.deposited || 0,
        rewardAmount: autoReward,
      },
      attendancePct: finalAttendance,
      testMarksPct: finalTestMarks,
      feeBalancePct: finalFeeBalancePct,
      feeAmount: finalFeeAmount,
      rewardAmount,
      quizBonus,
      grandTotal,
      isHoliday: finalHoliday,
      attendance: att ? { ...att, percentage: attendancePct } : null,
      testMarks: gr ? { ...gr, percentage: testMarksPct } : null,
      fee: fee ? { monthlyFee: fee.monthlyFee, otherCharges: fee.otherCharges, deposited: fee.deposited, balance: fee.balance, hasLateFee: fee.hasLateFee, lateFeeAmount: fee.lateFeeAmount } : null,
      depositedThisMonth,
      balanceBeforeDeposit,
      runningBalance: cumulative?.balance || 0,
      discipline: report?.discipline || null,
      comment: report?.comment || null,
      reportId: report?.id || null,
      hasOverrides: report?.attendancePct != null || report?.testMarksPct != null || report?.feeSubmissionPct != null || report?.feeAmount != null,
      hasLateFee,
      lateFeeAmount,
      scholarshipBreakdown: {
        attAmount: Math.round(attAmount),
        testAmount: Math.round(testAmount),
        feeAmount: Math.round(feeAmount),
        autoTotal: autoReward,
        quizBonus,
        grandTotal,
        monthlyMax: monthlyScholarship,
        annualScholarship,
        feeBalancePct: finalFeeBalancePct,
        latePenalty: hasLateFee,
      },
    };
  });

  return Response.json({
    student: {
      id: student.id,
      name: `${student.user.firstName} ${student.user.lastName}`,
      class: student.class?.name,
      section: student.section?.name,
      admissionNo: student.admissionNo,
    },
    academicYear,
    annualScholarship,
    monthlyScholarship,
    weights: scholarshipWeights,
    diary,
    _debug: {
      attendanceRecords: attendances.length,
      gradeRecords: grades.length,
      feeLedgerRecords: feeLedger.length,
      monthlyReportRecords: monthlyReports.length,
      monthsWithAttendance: Object.keys(attendanceByMonth),
      monthsWithGrades: Object.keys(gradesByMonth),
      monthsWithFees: Object.keys(feeByMonth),
    },
  });
}

// Save/update monthly report — all fields
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  const body = await request.json();
  const { month, academicYear, discipline, comment, attendancePct, testMarksPct, feeSubmissionPct, feeAmount, rewardAmount, quizBonus, isHoliday } = body;

  if (!month || !academicYear) {
    return Response.json({ error: 'month and academicYear are required' }, { status: 400 });
  }

  const data = {
    discipline: discipline || null,
    comment: comment || null,
    attendancePct: attendancePct != null && attendancePct !== '' ? parseFloat(attendancePct) : null,
    testMarksPct: testMarksPct != null && testMarksPct !== '' ? parseFloat(testMarksPct) : null,
    feeSubmissionPct: feeSubmissionPct != null && feeSubmissionPct !== '' ? parseFloat(feeSubmissionPct) : null,
    feeAmount: feeAmount != null && feeAmount !== '' ? parseFloat(feeAmount) : null,
    rewardAmount: rewardAmount != null && rewardAmount !== '' ? parseFloat(rewardAmount) : null,
    quizBonus: quizBonus != null && quizBonus !== '' ? parseFloat(quizBonus) : null,
    isHoliday: isHoliday || false,
  };

  const report = await (prisma.monthlyReport as any).upsert({
    where: { studentId_month: { studentId, month } },
    create: { studentId, month, academicYear, ...data },
    update: data,
  });

  return Response.json(report);
}
