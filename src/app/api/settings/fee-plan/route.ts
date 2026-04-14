import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// Fee plan is stored in SchoolSettings as JSON under key "feePlan"
// Structure: { academicYear, classes: [{ classId, className, monthlyFee, charges: [{ category, description, amount }] }] }

export async function GET() {
  const classes = await prisma.class.findMany({
    orderBy: { numericGrade: 'asc' },
    select: { id: true, name: true, numericGrade: true },
  });

  // Get saved fee plan
  const setting = await prisma.schoolSettings.findUnique({ where: { key: 'feePlan' } });
  let savedPlan: any = null;
  if (setting) {
    try { savedPlan = JSON.parse(setting.value); } catch {}
  }

  // Merge saved plan with current classes
  const classPlans = classes.map(cls => {
    const saved = savedPlan?.classes?.find((c: any) => c.classId === cls.id);
    return {
      classId: cls.id,
      className: cls.name,
      numericGrade: cls.numericGrade,
      monthlyFee: saved?.monthlyFee ?? 0,
      annualScholarship: saved?.annualScholarship ?? null,
      // Class-specific scholarship weights (null = use global weights)
      scholarshipWeights: saved?.scholarshipWeights ?? null,
      charges: saved?.charges ?? [
        { category: 'ADMISSION', description: 'Admission Charge', amount: 0 },
        { category: 'ANNUAL', description: 'Annual Charge', amount: 0 },
        { category: 'REGISTRATION', description: 'Registration Charge', amount: 0 },
        { category: 'BOOK', description: 'Book', amount: 0 },
        { category: 'DRESS', description: 'Dress-I', amount: 0 },
        { category: 'DRESS', description: 'Dress-II', amount: 0 },
        { category: 'COPY', description: 'Copy', amount: 0 },
        { category: 'DAIRY', description: 'Dairy', amount: 0 },
        { category: 'TIE_BELT', description: 'Tie / Belt', amount: 0 },
      ],
    };
  });

  return Response.json({
    academicYear: savedPlan?.academicYear || '2025-2026',
    classes: classPlans,
    annualScholarship: savedPlan?.annualScholarship ?? 1200,
    quizBonusAmount: savedPlan?.quizBonusAmount ?? 50,
    scholarshipWeights: savedPlan?.scholarshipWeights || {
      attendance: 10,
      testMarks: 20,
      feeBalance: 70,
    },
  });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { academicYear, classes, scholarshipWeights } = body;

  if (!classes || !Array.isArray(classes)) {
    return Response.json({ error: 'classes array required' }, { status: 400 });
  }

  const { annualScholarship, quizBonusAmount } = body;
  const plan = {
    academicYear: academicYear || '2025-2026',
    classes,
    annualScholarship: annualScholarship ?? 1200,
    quizBonusAmount: quizBonusAmount ?? 50,
    scholarshipWeights: scholarshipWeights || { attendance: 10, testMarks: 20, feeBalance: 70 },
  };

  await prisma.schoolSettings.upsert({
    where: { key: 'feePlan' },
    update: { value: JSON.stringify(plan) },
    create: { key: 'feePlan', value: JSON.stringify(plan), label: 'Annual Fee Plan' },
  });

  // Also create/update FeeStructure records for each class
  for (const cls of classes) {
    if (cls.monthlyFee > 0) {
      const existing = await prisma.feeStructure.findFirst({
        where: { classId: cls.classId, feeType: 'TUITION', academicYear: academicYear || '2025-2026' },
      });
      if (existing) {
        await prisma.feeStructure.update({ where: { id: existing.id }, data: { amount: cls.monthlyFee } });
      } else {
        await prisma.feeStructure.create({
          data: {
            name: `Monthly Fee - ${cls.className}`, classId: cls.classId, feeType: 'TUITION',
            amount: cls.monthlyFee, frequency: 'MONTHLY',
            dueDate: new Date(`${(academicYear || '2025-2026').split('-')[0]}-04-10`),
            academicYear: academicYear || '2025-2026',
          },
        });
      }
    }
  }

  return Response.json({ message: 'Fee plan saved', classCount: classes.length });
}
