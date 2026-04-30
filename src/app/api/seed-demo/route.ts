import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

// GET /api/seed-demo — creates Admin, Teacher, Parent demo users idempotently.
// Open this URL in a browser to seed:
//   https://school-erp01.vercel.app/api/seed-demo
export async function GET() {
  const logs: string[] = [];
  const log = (msg: string) => { logs.push(msg); console.log(msg); };

  try {
    // --- Admin ---
    const adminHash = await bcrypt.hash('password123', 12);
    const admin = await prisma.user.upsert({
      where: { email: 'admin@school.com' },
      update: { passwordHash: adminHash, isActive: true },
      create: {
        email: 'admin@school.com',
        passwordHash: adminHash,
        role: 'ADMIN',
        firstName: 'Admin',
        lastName: 'User',
        phone: '9000000000',
      },
    });
    log(`Admin: ${admin.email} / password123`);

    // --- Teacher (with Teacher record) ---
    const teacherHash = await bcrypt.hash('teacher123', 12);
    const teacherUser = await prisma.user.upsert({
      where: { email: 'rahul.sharma@school.com' },
      update: { passwordHash: teacherHash, isActive: true },
      create: {
        email: 'rahul.sharma@school.com',
        passwordHash: teacherHash,
        role: 'TEACHER',
        firstName: 'Rahul',
        lastName: 'Sharma',
        phone: '9876543210',
      },
    });

    // Find existing Teacher by either userId or employeeId, otherwise create
    let teacherRecord = await prisma.teacher.findUnique({ where: { userId: teacherUser.id } });
    if (!teacherRecord) {
      // Maybe a Teacher already exists with EMP-001 from a partial earlier seed — link it
      const orphan = await prisma.teacher.findUnique({ where: { employeeId: 'EMP-001' } });
      if (orphan) {
        teacherRecord = await prisma.teacher.update({
          where: { id: orphan.id },
          data: { userId: teacherUser.id, qualification: 'M.Ed', experience: 8 },
        });
        log(`  Linked existing Teacher record (EMP-001) to ${teacherUser.email}`);
      } else {
        teacherRecord = await prisma.teacher.create({
          data: { userId: teacherUser.id, employeeId: 'EMP-001', qualification: 'M.Ed', experience: 8 },
        });
      }
    }
    log(`Teacher: ${teacherUser.email} / teacher123 (employeeId: ${teacherRecord.employeeId})`);

    // Optionally make this teacher class teacher of first available section
    const firstSection = await prisma.section.findFirst({ where: { classTeacherId: null } });
    if (firstSection && !firstSection.classTeacherId) {
      await prisma.section.update({
        where: { id: firstSection.id },
        data: { classTeacherId: teacherRecord.id },
      });
      log(`  Assigned as class teacher of section ${firstSection.id}`);
    }

    // --- Parent (with Parent record) ---
    const parentHash = await bcrypt.hash('parent123', 12);
    const parentUser = await prisma.user.upsert({
      where: { email: 'parent@school.com' },
      update: { passwordHash: parentHash, isActive: true },
      create: {
        email: 'parent@school.com',
        passwordHash: parentHash,
        role: 'PARENT',
        firstName: 'Parent',
        lastName: 'User',
        phone: '9000000001',
      },
    });

    let parentRecord = await prisma.parent.findUnique({ where: { userId: parentUser.id } });
    if (!parentRecord) {
      parentRecord = await prisma.parent.create({
        data: {
          userId: parentUser.id,
          occupation: 'Business',
          relationship: 'Father',
        },
      });
    }
    log(`Parent: ${parentUser.email} / parent123`);

    // Link to a student (optional)
    const orphanStudent = await prisma.student.findFirst({ where: { parentId: null } });
    if (orphanStudent) {
      await prisma.student.update({
        where: { id: orphanStudent.id },
        data: { parentId: parentRecord.id },
      });
      log(`  Linked parent to student ${orphanStudent.id}`);
    }

    return Response.json({
      success: true,
      message: 'Demo users seeded successfully',
      credentials: {
        admin: { email: 'admin@school.com', password: 'password123' },
        teacher: { email: 'rahul.sharma@school.com', password: 'teacher123' },
        parent: { email: 'parent@school.com', password: 'parent123' },
      },
      logs,
    });
  } catch (error: any) {
    return Response.json({
      success: false,
      error: error.message,
      logs,
    }, { status: 500 });
  }
}
