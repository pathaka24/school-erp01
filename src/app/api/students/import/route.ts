import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { Role, Gender } from '@prisma/client';
import bcrypt from 'bcryptjs';

// POST /api/students/import
// Body: { classId, sectionId, rows: ImportRow[] }
// Each ImportRow: { firstName, lastName?, dateOfBirth?, gender?, fatherName?, motherName?, fatherPhone?, contact?, aadhaarNumber?, caste? }
// Creates User + Student for each row, auto-generates admission number, defaults for missing fields.
// Returns { created: [...], failed: [...] }

type ImportRow = {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string; // ISO string or "DD/MM/YYYY"
  gender?: string;
  fatherName?: string;
  motherName?: string;
  fatherPhone?: string;
  contact?: string;
  aadhaarNumber?: string;
  caste?: string;
};

// Parse DD/MM/YYYY, D/M/YYYY, or ISO dates. Returns null if blank/invalid.
function parseDate(value: string | undefined): Date | null {
  if (!value || !value.trim()) return null;
  const v = value.trim();
  // Try ISO first
  const iso = new Date(v);
  if (!isNaN(iso.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(v)) return iso;
  // Try DD/MM/YYYY or D/M/YYYY
  const m = v.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) return d;
  }
  return null;
}

function normalizeGender(value: string | undefined): Gender {
  if (!value) return Gender.OTHER;
  const v = value.trim().toUpperCase();
  if (v === 'M' || v === 'MALE' || v === 'BOY') return Gender.MALE;
  if (v === 'F' || v === 'FEMALE' || v === 'GIRL') return Gender.FEMALE;
  return Gender.OTHER;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { classId, sectionId, rows } = body as { classId: string; sectionId: string; rows: ImportRow[] };

  if (!classId || !sectionId) {
    return Response.json({ error: 'classId and sectionId are required' }, { status: 400 });
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ error: 'rows array is required' }, { status: 400 });
  }

  // Verify class/section exist
  const [cls, sec] = await Promise.all([
    prisma.class.findUnique({ where: { id: classId } }),
    prisma.section.findUnique({ where: { id: sectionId } }),
  ]);
  if (!cls) return Response.json({ error: 'Class not found' }, { status: 404 });
  if (!sec) return Response.json({ error: 'Section not found' }, { status: 404 });

  // Get next admission number base
  const currentYear = new Date().getFullYear();
  const prefix = `ADM-${currentYear}-`;
  const lastStudent = await prisma.student.findFirst({
    where: { admissionNo: { startsWith: prefix } },
    orderBy: { admissionNo: 'desc' },
    select: { admissionNo: true },
  });
  let nextNum = 1;
  if (lastStudent) {
    const n = parseInt(lastStudent.admissionNo.replace(prefix, ''), 10);
    if (!isNaN(n)) nextNum = n + 1;
  }

  const passwordHash = await bcrypt.hash('student123', 12);
  const created: { rowIndex: number; admissionNo: string; studentId: string; name: string }[] = [];
  const failed: { rowIndex: number; error: string; row: ImportRow }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const firstName = (row.firstName || '').trim();
    if (!firstName) {
      failed.push({ rowIndex: i, error: 'firstName is required', row });
      continue;
    }

    const admissionNo = `${prefix}${String(nextNum).padStart(4, '0')}`;
    const emailSlug = [firstName, row.lastName].filter(Boolean).join('.').toLowerCase().replace(/\s+/g, '.');
    const email = `${emailSlug || 'student'}.${nextNum}@school.edu`;

    const dob = parseDate(row.dateOfBirth) || new Date('1900-01-01');
    const gender = normalizeGender(row.gender);
    const phone = (row.contact || row.fatherPhone || '').trim() || null;

    try {
      const student = await prisma.student.create({
        data: {
          admissionNo,
          dateOfBirth: dob,
          gender,
          nationality: 'Indian',
          aadhaarNumber: row.aadhaarNumber?.trim() || null,
          fatherName: row.fatherName?.trim() || null,
          fatherPhone: row.fatherPhone?.trim() || row.contact?.trim() || null,
          motherName: row.motherName?.trim() || null,
          admissionDate: new Date(),
          stream: 'NONE',
          class: { connect: { id: classId } },
          section: { connect: { id: sectionId } },
          user: {
            create: {
              email,
              passwordHash,
              firstName,
              lastName: row.lastName?.trim() || '',
              phone,
              role: Role.STUDENT,
            },
          },
        },
        select: { id: true, admissionNo: true, user: { select: { firstName: true, lastName: true } } },
      });
      created.push({
        rowIndex: i,
        admissionNo: student.admissionNo,
        studentId: student.id,
        name: `${student.user.firstName} ${student.user.lastName}`.trim(),
      });
      nextNum += 1;
    } catch (err: any) {
      let msg = err?.message || 'Unknown error';
      if (err?.code === 'P2002') {
        const target = err.meta?.target;
        msg = `Duplicate ${Array.isArray(target) ? target.join(', ') : target || 'field'}`;
      }
      failed.push({ rowIndex: i, error: msg, row });
    }
  }

  return Response.json({
    created,
    failed,
    summary: { total: rows.length, successful: created.length, failed: failed.length },
  }, { status: 201 });
}
