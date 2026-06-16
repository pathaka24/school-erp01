import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireScope } from '@/lib/apiAuth';

// POST /api/students/[id]/link-sibling — connect an already-enrolled student as
// a sibling of this student. Both end up in one family:
//   - if this student already has a family → the sibling joins it
//   - else if the sibling has a family → this student joins it
//   - else a new family is created and both are added
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireScope(request, 'students');
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const { siblingId } = await request.json();
  if (!siblingId) return Response.json({ error: 'siblingId is required' }, { status: 400 });
  if (siblingId === id) return Response.json({ error: 'Cannot link a student to themselves' }, { status: 400 });

  const [student, sibling] = await Promise.all([
    prisma.student.findUnique({ where: { id }, select: { id: true, familyId: true, user: { select: { lastName: true } } } }),
    prisma.student.findUnique({ where: { id: siblingId }, select: { id: true, familyId: true } }),
  ]);
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });
  if (!sibling) return Response.json({ error: 'Sibling not found' }, { status: 404 });

  // Resolve the target family
  let familyId = student.familyId || sibling.familyId || null;
  if (!familyId) {
    const surname = (student.user?.lastName || 'New').trim();
    const family = await prisma.family.create({
      data: { familyId: `FAM-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`, name: `${surname} Family` },
    });
    familyId = family.id;
  }

  // Put both students (and keep any existing members) in that family
  await prisma.student.updateMany({
    where: { id: { in: [id, siblingId] } },
    data: { familyId },
  });

  return Response.json({ message: 'Sibling connected', familyId });
}

// DELETE /api/students/[id]/link-sibling?siblingId=... — remove a sibling from
// this student's family (unlink). If the family is left with fewer than two
// members, it's dissolved so no one is stranded in a one-person "family".
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireScope(request, 'students');
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const siblingId = request.nextUrl.searchParams.get('siblingId');
  if (!siblingId) return Response.json({ error: 'siblingId is required' }, { status: 400 });

  const [student, sibling] = await Promise.all([
    prisma.student.findUnique({ where: { id }, select: { familyId: true } }),
    prisma.student.findUnique({ where: { id: siblingId }, select: { id: true, familyId: true } }),
  ]);
  if (!student || !sibling) return Response.json({ error: 'Student not found' }, { status: 404 });
  if (!student.familyId || sibling.familyId !== student.familyId) {
    return Response.json({ error: 'That student is not a sibling in this family' }, { status: 400 });
  }

  const familyId = student.familyId;
  // Unlink the sibling
  await prisma.student.update({ where: { id: siblingId }, data: { familyId: null } });

  // Dissolve the family if it now has fewer than 2 members
  const remaining = await prisma.student.findMany({ where: { familyId }, select: { id: true } });
  if (remaining.length < 2) {
    await prisma.student.updateMany({ where: { familyId }, data: { familyId: null } });
    await prisma.family.delete({ where: { id: familyId } }).catch(() => {});
  }

  return Response.json({ message: 'Sibling removed' });
}
