import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

// POST /api/import/students
// Body: { rows: [{ admissionNo, firstName, lastName, email?, dateOfBirth, gender, classId, sectionId, ... }] }
// Returns { created, skipped, errors: [{row, error}] }
export async function POST(request: NextRequest) {
  const { rows } = await request.json();
  if (!Array.isArray(rows)) return Response.json({ error: 'rows must be an array' }, { status: 400 });

  const created: string[] = [];
  const skipped: string[] = [];
  const errors: { row: number; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      if (!r.admissionNo || !r.firstName || !r.lastName || !r.dateOfBirth || !r.gender || !r.classId || !r.sectionId) {
        errors.push({ row: i + 1, error: 'Missing required field (admissionNo, firstName, lastName, dateOfBirth, gender, classId, sectionId)' });
        continue;
      }

      const existing = await prisma.student.findUnique({ where: { admissionNo: r.admissionNo } });
      if (existing) { skipped.push(r.admissionNo); continue; }

      const email = r.email || `${r.admissionNo.toLowerCase()}@school.local`;
      const userExists = await prisma.user.findUnique({ where: { email } });
      if (userExists) { errors.push({ row: i + 1, error: `Email ${email} already in use` }); continue; }

      const passwordHash = await bcrypt.hash(r.password || 'student123', 12);
      await prisma.user.create({
        data: {
          email, passwordHash, role: 'STUDENT',
          firstName: r.firstName, lastName: r.lastName, phone: r.phone || null,
          student: {
            create: {
              admissionNo: r.admissionNo,
              dateOfBirth: new Date(r.dateOfBirth),
              gender: r.gender.toUpperCase(),
              bloodGroup: r.bloodGroup || null,
              classId: r.classId,
              sectionId: r.sectionId,
              rollNumber: r.rollNumber || null,
              fatherName: r.fatherName || null,
              fatherPhone: r.fatherPhone || null,
              motherName: r.motherName || null,
              motherPhone: r.motherPhone || null,
              currentAddress: r.address || null,
              currentCity: r.city || null,
              currentState: r.state || null,
              currentPincode: r.pincode || null,
            },
          },
        },
      });
      created.push(r.admissionNo);
    } catch (e: any) {
      errors.push({ row: i + 1, error: e.message || 'Unknown error' });
    }
  }

  return Response.json({ created: created.length, skipped: skipped.length, errors, createdList: created, skippedList: skipped });
}
