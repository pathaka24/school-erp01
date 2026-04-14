import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

const TEACHERS = [
  { firstName: 'Deeksha', lastName: 'Mishra', phone: '9911938387', email: 'kumdarpanditk89@gmail.com', role: '10th', empId: 'EMP-001' },
  { firstName: 'Deepika', lastName: '', phone: '9582835144', email: 'dikashpoo46@gmail.com', role: '6th', empId: 'EMP-002' },
  { firstName: 'Ajay', lastName: '', phone: '6399897223', email: 'dcog5653@gmail.com', role: '3rd', empId: 'EMP-003' },
  { firstName: 'Sneha', lastName: '', phone: '8700471225', email: 'ajaygopal2070@gmail.com', role: 'Music Teacher', empId: 'EMP-004' },
  { firstName: 'Adarsh', lastName: 'Mishra', phone: '9315740946', email: 'snehapal1705@gmail.com', role: '4th', empId: 'EMP-005' },
  { firstName: 'Monika', lastName: '', phone: '8851961819', email: 'mikeykrishna01@gmail.com', role: '8th, English', empId: 'EMP-006' },
  { firstName: 'Priyanshu', lastName: 'Jha', phone: '9266899027', email: 'monikamoni295@gmail.com', role: '7th', empId: 'EMP-007' },
  { firstName: 'Raushan', lastName: 'Mishra', phone: '9117921492', email: 'uha82602@gmail.com', role: '', empId: 'EMP-008' },
  { firstName: 'Priya', lastName: 'Kumari', phone: '8709923672', email: 'rk6980718@gmail.com', role: '9th', empId: 'EMP-009' },
  { firstName: 'Sakshi', lastName: 'Kumari', phone: '8287745022', email: 'kumaripriyall01203@gmail.com', role: '9th', empId: 'EMP-010' },
  { firstName: 'Nishu', lastName: 'Poddar', phone: '7044290770', email: 'sk8377051810@gmail.com', role: 'Nursery, Play', empId: 'EMP-011' },
  { firstName: 'Shrishti', lastName: 'Mishra', phone: '9643167872', email: 'shrishti56@gmail.com', role: 'UKG', empId: 'EMP-012' },
  { firstName: 'Ankita', lastName: 'Singh', phone: '9993843057', email: null, role: 'UKG', empId: 'EMP-013' },
  { firstName: 'Anjali', lastName: 'Mishra', phone: '8808470126', email: null, role: 'LKG', empId: 'EMP-014' },
  { firstName: 'Ashu', lastName: 'Chaubey', phone: '9456910619', email: 'lukeshgupta1001@gmail.com', role: '5th', empId: 'EMP-015' },
  { firstName: 'Himanshu', lastName: '', phone: '8851108605', email: null, role: '1st', empId: 'EMP-016' },
  { firstName: 'Vini', lastName: '', phone: '8205332250', email: null, role: '', empId: 'EMP-017' },
];

export async function GET() {
  const passwordHash = await bcrypt.hash('password123', 12);
  const results: any[] = [];
  let created = 0;
  let fixed = 0;
  let skipped = 0;

  for (const t of TEACHERS) {
    const email = t.email || `${t.firstName.toLowerCase()}${t.lastName ? '.' + t.lastName.toLowerCase() : ''}.${t.empId.toLowerCase()}@school.local`;

    try {
      // Check if teacher with this empId exists
      const existingTeacher = await prisma.teacher.findUnique({ where: { employeeId: t.empId } });
      if (existingTeacher) {
        skipped++;
        results.push({ name: `${t.firstName} ${t.lastName}`.trim(), empId: t.empId, email, status: 'exists', password: 'password123' });
        continue;
      }

      // Check if user with this email exists (orphan from previous attempt)
      let user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        // User exists but no teacher record — fix it
        await prisma.user.update({ where: { id: user.id }, data: { passwordHash, role: 'TEACHER', isActive: true } });
        await (prisma.teacher as any).create({ data: { userId: user.id, employeeId: t.empId } });
        fixed++;
        results.push({ name: `${t.firstName} ${t.lastName}`.trim(), empId: t.empId, email, status: 'fixed (user existed, teacher created)', password: 'password123' });
        continue;
      }

      // Create new user + teacher
      user = await prisma.user.create({
        data: { email, passwordHash, firstName: t.firstName, lastName: t.lastName || '', phone: t.phone, role: 'TEACHER' },
      });
      await (prisma.teacher as any).create({ data: { userId: user.id, employeeId: t.empId } });
      created++;
      results.push({ name: `${t.firstName} ${t.lastName}`.trim(), empId: t.empId, email, classRole: t.role || '—', status: 'created', password: 'password123' });
    } catch (err: any) {
      results.push({ name: `${t.firstName} ${t.lastName}`.trim(), empId: t.empId, status: `error: ${err.message?.slice(0, 100)}` });
    }
  }

  return Response.json({
    message: `${created} created, ${fixed} fixed, ${skipped} already exist`,
    defaultPassword: 'password123',
    teachers: results,
  });
}
