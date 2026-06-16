import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/students/[id]/siblings — list the other students in this student's family
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const student = await prisma.student.findUnique({ where: { id }, select: { familyId: true } });
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });

  if (!student.familyId) return Response.json({ familyId: null, siblings: [] });

  const family = await prisma.family.findUnique({
    where: { id: student.familyId },
    include: {
      students: {
        where: { id: { not: id } },
        include: {
          user: { select: { firstName: true, lastName: true, isActive: true } },
          class: { select: { name: true } },
          section: { select: { name: true } },
        },
      },
    },
  });

  return Response.json({
    familyId: student.familyId,
    familyName: family?.name || null,
    siblings: (family?.students || []).map(s => ({
      id: s.id, admissionNo: s.admissionNo,
      name: `${s.user.firstName} ${s.user.lastName}`.trim(),
      class: s.class?.name, section: s.section?.name,
      active: s.user.isActive,
    })),
  });
}

// POST /api/students/[id]/link-sibling is handled in ../link-sibling/route.ts
