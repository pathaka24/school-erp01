import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

// GET /api/seed-parent — run from browser to seed a parent user
export async function GET() {
  const logs: string[] = [];
  const log = (msg: string) => { logs.push(msg); console.log(msg); };

  try {
    log('Seeding parent user...');

    // Check if parent user already exists
    let parentUser = await prisma.user.findUnique({ where: { email: 'parent@school.com' } });

    if (parentUser) {
      log('Parent user already exists — skipping user creation');
    } else {
      const passwordHash = await bcrypt.hash('parent123', 12);
      parentUser = await prisma.user.create({
        data: {
          email: 'parent@school.com',
          passwordHash,
          role: 'PARENT',
          firstName: 'Parent',
          lastName: 'User',
          phone: '9000000001',
        },
      });
      log(`Created parent user: ${parentUser.id}`);
    }

    // Check if Parent record exists
    let parentRecord = await prisma.parent.findUnique({ where: { userId: parentUser.id } });
    if (parentRecord) {
      log('Parent record already exists — skipping');
    } else {
      parentRecord = await prisma.parent.create({
        data: {
          userId: parentUser.id,
          occupation: 'Business',
          relationship: 'Father',
        },
      });
      log(`Created parent record: ${parentRecord.id}`);
    }

    // Link first 2 students to this parent
    const students = await prisma.student.findMany({
      take: 2,
      orderBy: { admissionNo: 'asc' },
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    if (students.length === 0) {
      log('No students found in DB — please run /api/seed first');
      return Response.json({ success: false, error: 'No students found. Run /api/seed first.', logs }, { status: 400 });
    }

    let linked = 0;
    for (const student of students) {
      if (student.parentId === parentRecord.id) {
        log(`Student ${student.user.firstName} ${student.user.lastName} (${student.admissionNo}) already linked`);
      } else {
        await prisma.student.update({
          where: { id: student.id },
          data: { parentId: parentRecord.id },
        });
        log(`Linked student: ${student.user.firstName} ${student.user.lastName} (${student.admissionNo})`);
        linked++;
      }
    }

    log(`\nDone! Parent user: parent@school.com / parent123`);
    log(`Linked ${linked} new student(s), ${students.length} total children`);

    return Response.json({
      success: true,
      credentials: { email: 'parent@school.com', password: 'parent123' },
      parent: { id: parentRecord.id, userId: parentUser.id },
      children: students.map(s => ({
        id: s.id,
        name: `${s.user.firstName} ${s.user.lastName}`,
        admissionNo: s.admissionNo,
      })),
      logs,
    });

  } catch (error: any) {
    log(`ERROR: ${error.message}`);
    return Response.json({ success: false, error: error.message, logs }, { status: 500 });
  }
}
