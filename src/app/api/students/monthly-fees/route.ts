import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireScope } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

// GET /api/students/monthly-fees?classId=&sectionId=
// Roster of a class's active students with their per-student monthly fee
// override and the class default (from the fee plan) for reference.
export async function GET(request: NextRequest) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const sp = request.nextUrl.searchParams;
  const classId = sp.get('classId');
  const sectionId = sp.get('sectionId');
  if (!classId) return Response.json({ error: 'classId is required' }, { status: 400 });

  // Class default from the saved fee plan
  const setting = await prisma.schoolSettings.findUnique({ where: { key: 'feePlan' } });
  let classDefault = 0;
  if (setting) {
    try {
      const plan = JSON.parse(setting.value);
      const cp = plan?.classes?.find((c: any) => c.classId === classId);
      classDefault = Number(cp?.monthlyFee) || 0;
    } catch {}
  }

  const students = await prisma.student.findMany({
    where: { classId, ...(sectionId ? { sectionId } : {}), user: { isActive: true } },
    select: {
      id: true, admissionNo: true, rollNumber: true, monthlyFee: true, feeExempt: true,
      user: { select: { firstName: true, lastName: true } },
      section: { select: { name: true } },
    },
    orderBy: [{ rollNumber: 'asc' }, { user: { firstName: 'asc' } }],
  });

  return Response.json({
    classDefault,
    students: students.map(s => ({
      id: s.id,
      name: `${s.user.firstName} ${s.user.lastName}`.trim(),
      admissionNo: s.admissionNo,
      rollNumber: s.rollNumber,
      section: s.section?.name || '',
      monthlyFee: s.monthlyFee,
      feeExempt: s.feeExempt,
      effective: s.feeExempt ? 0 : (s.monthlyFee != null && s.monthlyFee > 0 ? s.monthlyFee : classDefault),
    })),
  });
}

// POST /api/students/monthly-fees
// Body: { updates: [{ studentId, monthlyFee }] }  — monthlyFee = number, or null/'' to clear (use class default)
export async function POST(request: NextRequest) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const updates = Array.isArray(body.updates) ? body.updates : [];
  if (updates.length === 0) return Response.json({ error: 'updates[] is required' }, { status: 400 });

  const ops = updates
    .filter((u: any) => u && u.studentId)
    .map((u: any) => {
      const raw = u.monthlyFee;
      const val = raw === null || raw === '' || raw === undefined ? null : Number(raw);
      return prisma.student.update({
        where: { id: u.studentId },
        data: { monthlyFee: val != null && !isNaN(val) && val > 0 ? val : null },
      });
    });
  if (ops.length === 0) return Response.json({ error: 'No valid updates' }, { status: 400 });

  await prisma.$transaction(ops);
  return Response.json({ updated: ops.length });
}
