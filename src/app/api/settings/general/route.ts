import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const settings = await prisma.schoolSettings.findMany();
  // Convert array to key-value object
  const result: Record<string, any> = {};
  settings.forEach(s => {
    try { result[s.key] = JSON.parse(s.value); } catch { result[s.key] = s.value; }
  });
  return Response.json(result);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  // body is { key: value, key: value, ... }

  const LABELS: Record<string, string> = {
    schoolName: 'School Name',
    schoolAddress: 'School Address',
    schoolPhone: 'School Phone',
    schoolEmail: 'School Email',
    schoolLogo: 'School Logo URL',
    academicYear: 'Current Academic Year',
    academicYearStart: 'Academic Year Start Month',
    academicYearEnd: 'Academic Year End Month',
    passingPercentage: 'Default Passing Percentage',
    attendanceThreshold: 'Minimum Attendance %',
    gradingSystem: 'Grading System Type',
    maxMarksDefault: 'Default Max Marks',
    reportCardTitle: 'Report Card Title',
    reportCardSubtitle: 'Report Card Subtitle',
    currency: 'Currency Symbol',
    dateFormat: 'Date Format',
    feeLatePenalty: 'Late Fee Penalty %',
    promotionPolicy: 'Promotion Policy',
  };

  const results = [];
  for (const [key, value] of Object.entries(body)) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    const setting = await prisma.schoolSettings.upsert({
      where: { key },
      update: { value: stringValue },
      create: { key, value: stringValue, label: LABELS[key] || key },
    });
    results.push(setting);
  }

  return Response.json({ message: 'Settings updated', count: results.length });
}
