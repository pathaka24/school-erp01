import { NextRequest } from 'next/server';

// Eligibility calculator — simulate tier based on inputs
export async function POST(request: NextRequest) {
  const { examAvg, attendancePct, tuitionAmount } = await request.json();

  const combined = (examAvg * 0.70) + (attendancePct * 0.30);

  let tier = 'NONE';
  let discountPct = 0;

  if (combined >= 90 && examAvg >= 88 && attendancePct >= 95) {
    tier = 'DIAMOND'; discountPct = 25;
  } else if (combined >= 80 && examAvg >= 75 && attendancePct >= 85) {
    tier = 'GOLD'; discountPct = 15;
  } else if (combined >= 70 && examAvg >= 65 && attendancePct >= 80) {
    tier = 'SILVER'; discountPct = 10;
  } else if (combined >= 60 && examAvg >= 55 && attendancePct >= 75) {
    tier = 'BRONZE'; discountPct = 5;
  }

  if (attendancePct < 75) { tier = 'NONE'; discountPct = 0; }

  const credit = tuitionAmount * (discountPct / 100);
  const netPayable = tuitionAmount - credit;

  // What's needed for next tier
  const tiers = [
    { name: 'DIAMOND', combined: 90, exam: 88, attendance: 95, pct: 25 },
    { name: 'GOLD', combined: 80, exam: 75, attendance: 85, pct: 15 },
    { name: 'SILVER', combined: 70, exam: 65, attendance: 80, pct: 10 },
    { name: 'BRONZE', combined: 60, exam: 55, attendance: 75, pct: 5 },
  ];

  const currentIdx = tiers.findIndex(t => t.name === tier);
  const nextTier = currentIdx > 0 ? tiers[currentIdx - 1] : (currentIdx === -1 ? tiers[3] : null);

  return Response.json({
    combined: combined.toFixed(1),
    tier, discountPct, credit, netPayable,
    nextTier: nextTier ? {
      name: nextTier.name,
      needCombined: nextTier.combined,
      needExam: nextTier.exam,
      needAttendance: nextTier.attendance,
      pct: nextTier.pct,
      projectedAnnualSaving: tuitionAmount * 12 * (nextTier.pct / 100),
    } : null,
  });
}
