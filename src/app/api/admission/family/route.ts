import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

// POST /api/admission/family — admit multiple siblings at once
export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    familyName,         // "Pathak Family"
    // Shared parent info
    fatherName, fatherOccupation, fatherPhone, fatherEmail,
    motherName, motherOccupation, motherPhone, motherEmail,
    // Shared address
    currentAddress, currentCity, currentState, currentPincode,
    // Children array
    children,           // [{ firstName, lastName, dateOfBirth, gender, classId, sectionId, ... charges, ... }]
    // Combined payment
    deposit,            // { amount, paymentMethod, receivedBy }
    previousBalance,    // number
  } = body;

  if (!children || children.length < 2) {
    return Response.json({ error: 'At least 2 children required for family admission' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash('student123', 12);

  // Generate admission numbers
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

  // Create family
  const family = await prisma.family.create({
    data: {
      familyId: `FAM-${currentYear}-${String(Date.now()).slice(-4)}`,
      name: familyName || `${children[0].lastName || 'New'} Family`,
    },
  });

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const results: any[] = [];
  let grandTotalCharged = 0;
  const familyReceiptId = `FRCP-${prefix}${String(nextNum).padStart(4, '0')}`;

  for (let ci = 0; ci < children.length; ci++) {
    const child = children[ci];
    const admissionNo = `${prefix}${String(nextNum + ci).padStart(4, '0')}`;
    const email = child.email || `${child.firstName.toLowerCase()}.${child.lastName.toLowerCase()}.${nextNum + ci}@school.edu`;

    if (!child.firstName || !child.lastName || !child.dateOfBirth || !child.gender || !child.classId || !child.sectionId) {
      return Response.json({ error: `Child ${ci + 1}: firstName, lastName, dateOfBirth, gender, classId, sectionId are required` }, { status: 400 });
    }

    // Create student
    const student = await prisma.student.create({
      data: {
        admissionNo,
        dateOfBirth: new Date(child.dateOfBirth),
        gender: child.gender,
        bloodGroup: child.bloodGroup || null,
        nationality: child.nationality || 'Indian',
        religion: child.religion || null,
        category: child.category || null,
        aadhaarNumber: child.aadhaarNumber || null,
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
        prevSchoolName: child.prevSchoolName || null,
        prevSchoolBoard: child.prevSchoolBoard || null,
        prevLastGrade: child.prevLastGrade || null,
        prevTCNumber: child.prevTCNumber || null,
        admissionDate: now,
        house: child.house || null,
        stream: child.stream || 'NONE',
        family: { connect: { id: family.id } },
        class: { connect: { id: child.classId } },
        section: { connect: { id: child.sectionId } },
        user: {
          create: { email, passwordHash, firstName: child.firstName, lastName: child.lastName, phone: child.phone || fatherPhone || null, role: Role.STUDENT },
        },
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
    });

    // Create fee ledger entries for this child
    let balance = 0;

    // Previous balance (split per child)
    const childPrevBal = previousBalance && previousBalance > 0 ? Math.round(previousBalance / children.length) : 0;
    if (childPrevBal > 0) {
      balance += childPrevBal;
      await prisma.feeLedger.create({
        data: { studentId: student.id, date: now, month: currentMonth, type: 'CHARGE', category: 'PREVIOUS_BALANCE', description: 'Previous balance', amount: childPrevBal, balanceAfter: balance },
      });
    }

    // Child-specific charges
    const childCharges = child.charges || [];
    for (const charge of childCharges) {
      const amt = parseFloat(charge.amount);
      if (amt > 0) {
        balance += amt;
        await prisma.feeLedger.create({
          data: {
            studentId: student.id, date: now, month: currentMonth,
            type: 'CHARGE', category: charge.category || 'AD_HOC',
            description: charge.description || charge.category?.replace(/_/g, ' ') || 'Admission charge',
            amount: amt, balanceAfter: balance,
          },
        });
      }
    }

    grandTotalCharged += balance;

    results.push({
      ...student,
      admissionNo,
      childBalance: balance,
      chargesCount: childCharges.filter((c: any) => parseFloat(c.amount) > 0).length + (childPrevBal > 0 ? 1 : 0),
    });
  }

  // Combined family deposit — split across children
  let depositReceipts: string[] = [];
  if (deposit && deposit.amount > 0) {
    const totalDeposit = parseFloat(deposit.amount);
    // Split proportionally based on each child's charges
    for (let ci = 0; ci < results.length; ci++) {
      const child = results[ci];
      const childShare = grandTotalCharged > 0
        ? Math.round((child.childBalance / grandTotalCharged) * totalDeposit)
        : Math.round(totalDeposit / results.length);

      if (childShare > 0) {
        // Get current balance for this child
        const lastEntry = await prisma.feeLedger.findFirst({
          where: { studentId: child.id },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          select: { balanceAfter: true },
        });
        const currentBal = lastEntry?.balanceAfter ?? 0;
        const newBal = currentBal - childShare;
        const receipt = `${familyReceiptId}-${String(ci + 1).padStart(2, '0')}`;
        depositReceipts.push(receipt);

        await prisma.feeLedger.create({
          data: {
            studentId: child.id, date: now, month: currentMonth,
            type: 'DEPOSIT', category: 'DEPOSIT',
            description: `Family admission deposit via ${deposit.paymentMethod || 'CASH'}`,
            amount: childShare, balanceAfter: newBal,
            paymentMethod: deposit.paymentMethod || 'CASH',
            receiptNumber: receipt,
            receivedBy: deposit.receivedBy || null,
          },
        });
        child.depositAmount = childShare;
        child.finalBalance = newBal;
      }
    }
  }

  return Response.json({
    family: { id: family.id, familyId: family.familyId, name: family.name },
    children: results,
    summary: {
      totalChildren: results.length,
      totalCharged: grandTotalCharged,
      totalDeposited: deposit?.amount ? parseFloat(deposit.amount) : 0,
      finalBalance: grandTotalCharged - (deposit?.amount ? parseFloat(deposit.amount) : 0),
      familyReceiptId,
      depositReceipts,
    },
    message: `${results.length} children admitted to ${family.name}`,
  }, { status: 201 });
}
