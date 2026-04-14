import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const academicYear = request.nextUrl.searchParams.get('academicYear') || '2025-2026';

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: { select: { firstName: true, lastName: true } },
      class: true,
      section: { include: { classTeacher: { include: { user: { select: { firstName: true, lastName: true } } } } } },
    },
  });

  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });

  const [assessments, attendanceRecords] = await Promise.all([
    prisma.assessment.findMany({
      where: { studentId, academicYear },
      include: { subject: { select: { name: true, code: true } } },
      orderBy: { subject: { name: 'asc' } },
    }),
    prisma.attendance.findMany({ where: { studentId } }),
  ]);

  // Grade helper (5-point A-E scale matching the template)
  function getGrade(pct: number) {
    if (pct >= 91) return 'A+';
    if (pct >= 81) return 'A';
    if (pct >= 71) return 'B+';
    if (pct >= 61) return 'B';
    if (pct >= 51) return 'C+';
    if (pct >= 41) return 'C';
    if (pct >= 33) return 'D';
    return 'E';
  }

  // Build subjects — Term 1 (FT1/20 + SA1/80 = 100), Term 2 (FT2/20 + SA2/80 = 100), Annual/200
  const subjects = assessments.map(a => {
    const ft1 = (a as any).ft1 ?? a.fa1 ?? null;
    const sa1 = (a as any).sa1 ?? a.sa ?? null;
    const term1 = (a as any).term1 ?? (ft1 != null && sa1 != null ? ft1 + sa1 : null);
    const ft2 = (a as any).ft2 ?? a.fa2 ?? null;
    const sa2 = (a as any).sa2 ?? null;
    const term2 = (a as any).term2 ?? (ft2 != null && sa2 != null ? ft2 + sa2 : null);
    const total = a.total ?? (term1 != null && term2 != null ? term1 + term2 : null);
    const pct = total != null ? (total / 200) * 100 : 0;
    return {
      name: a.subject.name,
      code: a.subject.code,
      ft1, sa1, term1,
      ft2, sa2, term2,
      total,
      maxMarks: 200,
      percentage: pct.toFixed(1),
      grade: a.grade || getGrade(pct),
      remark: a.teacherRemark,
    };
  });

  // Totals
  const totalMarks = subjects.reduce((s, sub) => s + (sub.total || 0), 0);
  const maxMarks = subjects.filter(s => s.total != null).length * 200;
  const term1Total = subjects.reduce((s, sub) => s + (sub.term1 || 0), 0);
  const term1Max = subjects.filter(s => s.term1 != null).length * 100;
  const term2Total = subjects.reduce((s, sub) => s + (sub.term2 || 0), 0);
  const term2Max = subjects.filter(s => s.term2 != null).length * 100;
  const percentage = maxMarks > 0 ? (totalMarks / maxMarks) * 100 : 0;
  const term1Pct = term1Max > 0 ? (term1Total / term1Max) * 100 : 0;
  const term2Pct = term2Max > 0 ? (term2Total / term2Max) * 100 : 0;

  // Attendance
  const totalDays = attendanceRecords.length;
  const presentDays = attendanceRecords.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
  const attendancePct = totalDays > 0 ? (presentDays / totalDays * 100) : 0;

  // Rank
  const classStudents = await prisma.student.findMany({ where: { classId: student.classId }, select: { id: true } });
  const allAssessments = await prisma.assessment.findMany({
    where: { studentId: { in: classStudents.map(s => s.id) }, academicYear },
  });
  const studentTotals: Record<string, number> = {};
  allAssessments.forEach(a => {
    studentTotals[a.studentId] = (studentTotals[a.studentId] || 0) + (a.total || 0);
  });
  const sorted = Object.entries(studentTotals).sort((a, b) => b[1] - a[1]);
  const rank = sorted.findIndex(([id]) => id === studentId) + 1;

  // Result
  const result = percentage < 33 ? 'Detained' : 'Promoted';
  const [startYear] = academicYear.split('-').map(Number);
  const nextClass = student.class.numericGrade ? `${student.class.numericGrade + 1}` : '';

  return Response.json({
    student: {
      name: `${student.user.firstName} ${student.user.lastName}`,
      admissionNo: student.admissionNo,
      dob: student.dateOfBirth,
      class: student.class.name,
      section: student.section?.name,
      fatherName: student.fatherName,
      motherName: student.motherName,
      address: [student.currentAddress, student.currentCity].filter(Boolean).join(', '),
      classTeacher: student.section?.classTeacher ? `${student.section.classTeacher.user.firstName} ${student.section.classTeacher.user.lastName}` : null,
      photo: student.photo,
    },
    academicYear,
    subjects,
    totals: {
      term1: { marks: term1Total, max: term1Max, pct: term1Pct.toFixed(1) },
      term2: { marks: term2Total, max: term2Max, pct: term2Pct.toFixed(1) },
      annual: { marks: totalMarks, max: maxMarks, pct: percentage.toFixed(1) },
    },
    summary: {
      totalMarks, maxMarks,
      percentage: percentage.toFixed(1),
      grade: getGrade(percentage),
      rank, totalStudentsInClass: classStudents.length,
      attendancePct: attendancePct.toFixed(1),
      result,
      promotedTo: result === 'Promoted' ? nextClass : null,
    },
    dates: {
      issueDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      schoolReopen: `01/04/${startYear + 1}`,
    },
  });
}
