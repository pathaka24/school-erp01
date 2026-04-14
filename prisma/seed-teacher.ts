import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // --- Create admin user ---
  console.log('Creating admin user...');
  const adminHash = await bcrypt.hash('password123', 12);
  await prisma.user.upsert({
    where: { email: 'admin@school.com' },
    update: {},
    create: {
      email: 'admin@school.com',
      passwordHash: adminHash,
      role: 'ADMIN',
      firstName: 'Admin',
      lastName: 'User',
      phone: '9000000000',
    },
  });
  console.log('  admin@school.com / password123');

  // --- Create teacher ---
  console.log('Creating teacher...');
  const teacherHash = await bcrypt.hash('teacher123', 12);
  const teacherUser = await prisma.user.upsert({
    where: { email: 'rahul.sharma@school.com' },
    update: {},
    create: {
      email: 'rahul.sharma@school.com',
      passwordHash: teacherHash,
      role: 'TEACHER',
      firstName: 'Rahul',
      lastName: 'Sharma',
      phone: '9876543210',
    },
  });

  const classes = await prisma.class.findMany({ orderBy: { numericGrade: 'asc' } });
  const class1 = classes[0];
  if (!class1) { console.log('No classes found — run the full seed first'); return; }

  const sectionA = await prisma.section.findFirst({ where: { classId: class1.id, name: 'A' } });
  if (!sectionA) { console.log('Section A not found'); return; }

  const teacherRecord = await prisma.teacher.upsert({
    where: { userId: teacherUser.id },
    update: {},
    create: {
      userId: teacherUser.id,
      employeeId: 'EMP-001',
      qualification: 'M.Ed',
      experience: 8,
    },
  });

  // Assign as class teacher of Class 1 Section A
  await prisma.section.update({
    where: { id: sectionA.id },
    data: { classTeacherId: teacherRecord.id },
  });

  // Create subjects for Class 1 taught by this teacher
  const subjectData = [
    { name: 'Mathematics', code: 'MATH-1' },
    { name: 'English', code: 'ENG-1' },
    { name: 'Science', code: 'SCI-1' },
    { name: 'Hindi', code: 'HIN-1' },
    { name: 'Social Studies', code: 'SST-1' },
  ];

  for (const sub of subjectData) {
    await prisma.subject.upsert({
      where: { code: sub.code },
      update: {},
      create: {
        name: sub.name,
        code: sub.code,
        classId: class1.id,
        teacherId: teacherRecord.id,
      },
    });
  }

  console.log('  rahul.sharma@school.com / teacher123');
  console.log(`  Class Teacher of: ${class1.name} - Section A`);
  console.log('  Subjects: Mathematics, English, Science, Hindi, Social Studies');
  console.log('\nDone!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
