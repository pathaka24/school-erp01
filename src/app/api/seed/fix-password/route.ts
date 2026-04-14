import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

// Reset all teacher passwords to password123
export async function GET() {
  const passwordHash = await bcrypt.hash('password123', 12);
  const teachers = await prisma.teacher.findMany({
    include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
  });

  let fixed = 0;
  for (const t of teachers) {
    await prisma.user.update({ where: { id: t.userId }, data: { passwordHash, isActive: true } });
    fixed++;
  }

  return Response.json({
    message: `Reset password for ${fixed} teachers to: password123`,
    teachers: teachers.map(t => ({ name: `${t.user.firstName} ${t.user.lastName}`.trim(), email: t.user.email, empId: t.employeeId })),
  });
}
