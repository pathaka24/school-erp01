import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireScope } from '@/lib/apiAuth';

// GET /api/sections/[id] — fetch one section with class teacher info
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const section = await prisma.section.findUnique({
    where: { id },
    include: {
      class: { select: { id: true, name: true } },
      classTeacher: {
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      },
      students: {
        select: { id: true },
      },
    },
  });
  if (!section) return Response.json({ error: 'Section not found' }, { status: 404 });
  return Response.json({
    ...section,
    studentCount: section.students.length,
    students: undefined,
  });
}

// PATCH /api/sections/[id] — update section (rename, change class teacher).
// ADMIN only.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireScope(request, 'academics');
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();

  const data: any = {};
  if (body.name !== undefined) {
    if (!body.name || typeof body.name !== 'string') {
      return Response.json({ error: 'name must be a non-empty string' }, { status: 400 });
    }
    data.name = body.name.trim();
  }
  if (body.classTeacherId !== undefined) {
    // null clears the assignment
    if (body.classTeacherId === null || body.classTeacherId === '') {
      data.classTeacherId = null;
    } else {
      const teacher = await prisma.teacher.findUnique({ where: { id: body.classTeacherId } });
      if (!teacher) return Response.json({ error: 'Teacher not found' }, { status: 400 });
      data.classTeacherId = body.classTeacherId;
    }
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: 'No editable fields provided' }, { status: 400 });
  }

  try {
    const section = await prisma.section.update({
      where: { id },
      data,
      include: {
        class: { select: { id: true, name: true } },
        classTeacher: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });
    return Response.json(section);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return Response.json({ error: 'A section with this name already exists in the class' }, { status: 409 });
    }
    return Response.json({ error: 'Failed to update section: ' + error.message }, { status: 500 });
  }
}

// DELETE /api/sections/[id] — ADMIN only. Cascades to students/timetable per schema.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireScope(request, 'academics');
  if (auth instanceof Response) return auth;

  const { id } = await params;
  // Refuse if section has students — admin must move them first
  const studentCount = await prisma.student.count({ where: { sectionId: id } });
  if (studentCount > 0) {
    return Response.json(
      { error: `Cannot delete: ${studentCount} student(s) still in this section. Move them first.` },
      { status: 409 },
    );
  }
  try {
    await prisma.section.delete({ where: { id } });
    return Response.json({ deleted: true });
  } catch (error: any) {
    return Response.json({ error: 'Failed to delete section: ' + error.message }, { status: 500 });
  }
}
