import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding school settings...');

  // General settings
  const defaults: { key: string; value: string; label: string }[] = [
    { key: 'schoolName', value: 'Sunrise Public School', label: 'School Name' },
    { key: 'schoolAddress', value: '123, MG Road, Pune, Maharashtra 411001', label: 'School Address' },
    { key: 'schoolPhone', value: '+91 20 2567 8901', label: 'School Phone' },
    { key: 'schoolEmail', value: 'info@sunriseschool.edu', label: 'School Email' },
    { key: 'academicYear', value: '2025-2026', label: 'Current Academic Year' },
    { key: 'academicYearStart', value: '4', label: 'Academic Year Start Month' },
    { key: 'academicYearEnd', value: '3', label: 'Academic Year End Month' },
    { key: 'passingPercentage', value: '33', label: 'Default Passing Percentage' },
    { key: 'attendanceThreshold', value: '75', label: 'Minimum Attendance %' },
    { key: 'gradingSystem', value: 'PERCENTAGE', label: 'Grading System Type' },
    { key: 'maxMarksDefault', value: '100', label: 'Default Max Marks' },
    { key: 'reportCardTitle', value: 'Progress Report', label: 'Report Card Title' },
    { key: 'reportCardSubtitle', value: 'Academic Year 2025-26', label: 'Report Card Subtitle' },
    { key: 'currency', value: '₹', label: 'Currency Symbol' },
    { key: 'feeLatePenalty', value: '2', label: 'Late Fee Penalty %' },
    { key: 'promotionPolicy', value: 'MANUAL', label: 'Promotion Policy' },
  ];

  for (const s of defaults) {
    await prisma.schoolSettings.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }
  console.log(`  ${defaults.length} settings created`);

  // Grade scale (CBSE pattern)
  const grades = [
    { name: 'A1', minMarks: 91, maxMarks: 100, gpa: 10, remarks: 'Outstanding', order: 0 },
    { name: 'A2', minMarks: 81, maxMarks: 90, gpa: 9, remarks: 'Excellent', order: 1 },
    { name: 'B1', minMarks: 71, maxMarks: 80, gpa: 8, remarks: 'Very Good', order: 2 },
    { name: 'B2', minMarks: 61, maxMarks: 70, gpa: 7, remarks: 'Good', order: 3 },
    { name: 'C1', minMarks: 51, maxMarks: 60, gpa: 6, remarks: 'Above Average', order: 4 },
    { name: 'C2', minMarks: 41, maxMarks: 50, gpa: 5, remarks: 'Average', order: 5 },
    { name: 'D', minMarks: 33, maxMarks: 40, gpa: 4, remarks: 'Below Average', order: 6 },
    { name: 'E', minMarks: 0, maxMarks: 32, gpa: 0, remarks: 'Needs Improvement', order: 7 },
  ];

  for (const g of grades) {
    await prisma.gradeScale.upsert({
      where: { name: g.name },
      update: {},
      create: g,
    });
  }
  console.log(`  ${grades.length} grades created (CBSE pattern)`);

  // Exam patterns
  const examPatterns = [
    { name: 'FA1', displayName: 'Formative Assessment 1', maxMarks: 40, passingPct: 33, weightage: 10, category: 'FORMATIVE', order: 0 },
    { name: 'FA2', displayName: 'Formative Assessment 2', maxMarks: 40, passingPct: 33, weightage: 10, category: 'FORMATIVE', order: 1 },
    { name: 'FA3', displayName: 'Formative Assessment 3', maxMarks: 40, passingPct: 33, weightage: 10, category: 'FORMATIVE', order: 2 },
    { name: 'FA4', displayName: 'Formative Assessment 4', maxMarks: 40, passingPct: 33, weightage: 10, category: 'FORMATIVE', order: 3 },
    { name: 'SA1', displayName: 'Summative Assessment 1', maxMarks: 80, passingPct: 33, weightage: 30, category: 'SUMMATIVE', order: 4 },
    { name: 'SA2', displayName: 'Summative Assessment 2', maxMarks: 80, passingPct: 33, weightage: 30, category: 'SUMMATIVE', order: 5 },
    { name: 'UNIT_TEST', displayName: 'Unit Test', maxMarks: 25, passingPct: 33, weightage: 0, category: 'INTERNAL', isActive: false, order: 6 },
    { name: 'PRACTICAL', displayName: 'Practical / Lab', maxMarks: 20, passingPct: 33, weightage: 0, category: 'PRACTICAL', isActive: false, order: 7 },
  ];

  for (const ep of examPatterns) {
    await prisma.examPattern.upsert({
      where: { name: ep.name },
      update: {},
      create: {
        name: ep.name,
        displayName: ep.displayName,
        maxMarks: ep.maxMarks,
        passingPct: ep.passingPct,
        weightage: ep.weightage,
        category: ep.category,
        isActive: (ep as any).isActive !== false,
        order: ep.order,
      },
    });
  }
  console.log(`  ${examPatterns.length} exam patterns created (FA1-FA4 + SA1-SA2 + extras)`);

  console.log('\nSettings seed complete!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
