import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

// POST /api/import/teachers
// Body: { rows: [{ employeeId, firstName, lastName, email, designation?, qualification?, ... }] }
export async function POST(request: NextRequest) {
  const { rows } = await request.json();
  if (!Array.isArray(rows)) return Response.json({ error: 'rows must be an array' }, { status: 400 });

  const created: string[] = [];
  const skipped: string[] = [];
  const errors: { row: number; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      if (!r.employeeId || !r.firstName || !r.lastName || !r.email) {
        errors.push({ row: i + 1, error: 'Missing required field (employeeId, firstName, lastName, email)' });
        continue;
      }

      const existing = await prisma.teacher.findUnique({ where: { employeeId: r.employeeId } });
      if (existing) { skipped.push(r.employeeId); continue; }

      const userExists = await prisma.user.findUnique({ where: { email: r.email } });
      if (userExists) { errors.push({ row: i + 1, error: `Email ${r.email} already in use` }); continue; }

      const passwordHash = await bcrypt.hash(r.password || 'teacher123', 12);
      await prisma.user.create({
        data: {
          email: r.email, passwordHash, role: 'TEACHER',
          firstName: r.firstName, lastName: r.lastName, phone: r.phone || null,
          teacher: {
            create: {
              employeeId: r.employeeId,
              qualification: r.qualification || null,
              specialization: r.specialization || null,
              experience: r.experience ? Number(r.experience) : null,
              designation: r.designation || null,
              department: r.department || null,
              dateOfBirth: r.dateOfBirth ? new Date(r.dateOfBirth) : null,
              gender: r.gender || null,
              bloodGroup: r.bloodGroup || null,
              aadhaarNumber: r.aadhaarNumber || null,
              panNumber: r.panNumber || null,
              salary: r.salary ? Number(r.salary) : null,
              address: r.address || null,
              city: r.city || null,
              state: r.state || null,
              pincode: r.pincode || null,
            },
          },
        },
      });
      created.push(r.employeeId);
    } catch (e: any) {
      errors.push({ row: i + 1, error: e.message || 'Unknown error' });
    }
  }

  return Response.json({ created: created.length, skipped: skipped.length, errors, createdList: created, skippedList: skipped });
}
