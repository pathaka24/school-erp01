import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

// GET /api/admission — generate next admission number
export async function GET() {
  const currentYear = new Date().getFullYear();
  const prefix = `ADM-${currentYear}-`;

  // Find the highest admission number with this year's prefix
  const lastStudent = await prisma.student.findFirst({
    where: { admissionNo: { startsWith: prefix } },
    orderBy: { admissionNo: 'desc' },
    select: { admissionNo: true },
  });

  let nextNum = 1;
  if (lastStudent) {
    const lastNum = parseInt(lastStudent.admissionNo.replace(prefix, ''), 10);
    if (!isNaN(lastNum)) nextNum = lastNum + 1;
  }

  const admissionNo = `${prefix}${String(nextNum).padStart(4, '0')}`;

  // Also get counts for context
  const totalStudents = await prisma.student.count();
  const thisYearCount = await prisma.student.count({
    where: { admissionNo: { startsWith: prefix } },
  });

  // Get fee plan for auto-filling charges
  const feePlanSetting = await prisma.schoolSettings.findUnique({ where: { key: 'feePlan' } });
  let feePlan: any = null;
  if (feePlanSetting) {
    try { feePlan = JSON.parse(feePlanSetting.value); } catch {}
  }

  return Response.json({
    admissionNo,
    prefix,
    nextNumber: nextNum,
    totalStudents,
    thisYearAdmissions: thisYearCount,
    feePlan: feePlan?.classes || [],
  });
}

// POST /api/admission — create new student admission
export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    // Basic info
    firstName, lastName, email, phone,
    // Student details
    dateOfBirth, gender, bloodGroup,
    classId, sectionId,
    // Address
    currentAddress, currentCity, currentState, currentPincode,
    // Parent info
    fatherName, fatherOccupation, fatherPhone, fatherEmail,
    motherName, motherOccupation, motherPhone, motherEmail,
    // Optional
    nationality, religion, category, aadhaarNumber,
    // Previous school
    prevSchoolName, prevSchoolBoard, prevLastGrade, prevTCNumber,
    // Admission
    house, stream,
  } = body;

  // Admission charges (books, dress, etc.) and initial deposit
  const {
    charges, // [{ category: 'BOOK', description: 'Book Charge', amount: 2510 }, ...]
    initialDeposit, // { amount: 3000, paymentMethod: 'CASH', receivedBy: 'Goyal' }
    previousBalance, // number — carry forward from previous year
    siblingAdmissionNo, // string — if sibling exists, link to same family
  } = body;

  if (!firstName || !dateOfBirth || !gender || !classId || !sectionId) {
    return Response.json({ error: 'firstName, dateOfBirth, gender, classId, and sectionId are required' }, { status: 400 });
  }

  // Auto-generate admission number
  const currentYear = new Date().getFullYear();
  const prefix = `ADM-${currentYear}-`;
  const lastStudent = await prisma.student.findFirst({
    where: { admissionNo: { startsWith: prefix } },
    orderBy: { admissionNo: 'desc' },
    select: { admissionNo: true },
  });
  let nextNum = 1;
  if (lastStudent) {
    const lastNum = parseInt(lastStudent.admissionNo.replace(prefix, ''), 10);
    if (!isNaN(lastNum)) nextNum = lastNum + 1;
  }
  const admissionNo = `${prefix}${String(nextNum).padStart(4, '0')}`;

  // Auto-generate email if not provided
  const emailSlug = [firstName, lastName].filter(Boolean).join('.').toLowerCase() || 'student';
  const studentEmail = email || `${emailSlug}.${nextNum}@school.edu`;
  const passwordHash = await bcrypt.hash('student123', 12);

  try {
    // ─── Sibling detection: find or create family ───
    let familyId: string | null = null;
    let siblingInfo: any = null;

    if (siblingAdmissionNo) {
      const sibling = await prisma.student.findUnique({
        where: { admissionNo: siblingAdmissionNo },
        include: { user: { select: { firstName: true, lastName: true } }, family: true },
      });
      if (sibling) {
        siblingInfo = { id: sibling.id, name: `${sibling.user.firstName} ${sibling.user.lastName}` };
        if (sibling.familyId) {
          // Sibling already has a family — join it
          familyId = sibling.familyId;
        } else {
          // Create a new family and add sibling to it
          const family = await prisma.family.create({
            data: {
              familyId: `FAM-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
              name: `${lastName} Family`,
            },
          });
          familyId = family.id;
          await prisma.student.update({ where: { id: sibling.id }, data: { familyId: family.id } });
        }
      }
    }

    // ─── Create student ───
    const student = await prisma.student.create({
      data: {
        admissionNo,
        dateOfBirth: new Date(dateOfBirth),
        gender,
        bloodGroup: bloodGroup || null,
        nationality: nationality || 'Indian',
        religion: religion || null,
        category: category || null,
        aadhaarNumber: aadhaarNumber || null,
        currentAddress: currentAddress || null,
        currentCity: currentCity || null,
        currentState: currentState || null,
        currentPincode: currentPincode || null,
        fatherName: fatherName || null,
        fatherOccupation: fatherOccupation || null,
        fatherPhone: fatherPhone || null,
        fatherEmail: fatherEmail || null,
        motherName: motherName || null,
        motherOccupation: motherOccupation || null,
        motherPhone: motherPhone || null,
        motherEmail: motherEmail || null,
        prevSchoolName: prevSchoolName || null,
        prevSchoolBoard: prevSchoolBoard || null,
        prevLastGrade: prevLastGrade || null,
        prevTCNumber: prevTCNumber || null,
        admissionDate: new Date(),
        admittedGrade: null,
        house: house || null,
        stream: stream || 'NONE',
        ...(familyId ? { family: { connect: { id: familyId } } } : {}),
        class: { connect: { id: classId } },
        section: { connect: { id: sectionId } },
        user: {
          create: {
            email: studentEmail,
            passwordHash,
            firstName,
            lastName: lastName || '',
            phone: phone || fatherPhone || null,
            role: Role.STUDENT,
          },
        },
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        family: { select: { id: true, familyId: true, name: true } },
      },
    });

    // ─── Create fee ledger entries ───
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let balance = 0;

    // Previous year balance
    if (previousBalance && previousBalance > 0) {
      balance += previousBalance;
      await prisma.feeLedger.create({
        data: {
          studentId: student.id, date: now, month: currentMonth,
          type: 'CHARGE', category: 'PREVIOUS_BALANCE',
          description: 'Previous balance carried forward',
          amount: previousBalance, balanceAfter: balance,
        },
      });
    }

    // Admission charges (book, dress, annual, registration, etc.)
    if (charges && Array.isArray(charges)) {
      for (const charge of charges) {
        if (charge.amount > 0) {
          balance += charge.amount;
          await prisma.feeLedger.create({
            data: {
              studentId: student.id, date: now, month: currentMonth,
              type: 'CHARGE', category: charge.category || 'AD_HOC',
              description: charge.description || charge.category?.replace(/_/g, ' ') || 'Admission charge',
              amount: charge.amount, balanceAfter: balance,
            },
          });
        }
      }
    }

    // Initial deposit (fees paid at admission time)
    let depositReceipt: string | null = null;
    if (initialDeposit && initialDeposit.amount > 0) {
      balance -= initialDeposit.amount;
      depositReceipt = `RCP-${admissionNo}-ADM`;
      await prisma.feeLedger.create({
        data: {
          studentId: student.id, date: now, month: currentMonth,
          type: 'DEPOSIT', category: 'DEPOSIT',
          description: `Admission deposit via ${initialDeposit.paymentMethod || 'CASH'}`,
          amount: initialDeposit.amount, balanceAfter: balance,
          paymentMethod: initialDeposit.paymentMethod || 'CASH',
          receiptNumber: depositReceipt,
          receivedBy: initialDeposit.receivedBy || null,
        },
      });
    }

    return Response.json({
      ...student,
      admissionNo,
      message: `Student admitted successfully. Admission No: ${admissionNo}`,
      ledger: {
        chargesCount: (charges || []).length + (previousBalance > 0 ? 1 : 0),
        totalCharged: balance + (initialDeposit?.amount || 0),
        depositAmount: initialDeposit?.amount || 0,
        depositReceipt,
        currentBalance: balance,
      },
      sibling: siblingInfo,
    }, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      const field = error.meta?.target?.includes('email') ? 'Email' : 'Admission number';
      return Response.json({ error: `${field} already exists` }, { status: 409 });
    }
    return Response.json({ error: 'Failed to create admission: ' + error.message }, { status: 500 });
  }
}
