import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    const passwordHash = await bcrypt.hash('password123', 12);

    // Check if parent@school.com already exists
    const existing = await prisma.user.findUnique({ where: { email: 'parent@school.com' } });

    if (existing) {
      // Just fix the password and make sure role is PARENT
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, role: 'PARENT', isActive: true },
      });

      // Make sure parent record exists
      const parent = await prisma.parent.findUnique({ where: { userId: existing.id } });
      if (!parent) {
        const p = await prisma.parent.create({ data: { userId: existing.id } });
        // Link a student
        const student = await prisma.student.findFirst({ where: { parentId: null } });
        if (student) await prisma.student.update({ where: { id: student.id }, data: { parentId: p.id } });
      }

      // Get children
      const parentRec = await prisma.parent.findUnique({
        where: { userId: existing.id },
        include: { students: { include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } } },
      });

      return Response.json({
        message: 'Parent login ready!',
        email: 'parent@school.com',
        password: 'password123',
        children: parentRec?.students.map(s => `${s.user.firstName} ${s.user.lastName} (${s.class?.name})`) || [],
      });
    }

    // Create new parent user
    const student = await prisma.student.findFirst({
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    if (!student) return Response.json({ error: 'No students exist' }, { status: 404 });

    const parentUser = await prisma.user.create({
      data: { email: 'parent@school.com', passwordHash, firstName: student.fatherName || 'Parent', lastName: student.user.lastName, role: 'PARENT' },
    });
    const parent = await prisma.parent.create({ data: { userId: parentUser.id } });
    await prisma.student.update({ where: { id: student.id }, data: { parentId: parent.id } });

    return Response.json({
      message: 'Parent created!',
      email: 'parent@school.com',
      password: 'password123',
      children: [`${student.user.firstName} ${student.user.lastName}`],
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
