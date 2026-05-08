import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/fees/ledger/entry/[id]/receipt
// Returns the data needed to print a receipt for a single DEPOSIT entry:
//  - the deposit itself (amount, date, method, receipt#)
//  - the student + class + section info
//  - the list of charges this deposit paid (via FIFO walk on non-voided entries)
//  - balance before and after the deposit
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const deposit = await prisma.feeLedger.findUnique({
    where: { id },
    include: {
      student: {
        include: {
          user: { select: { firstName: true, lastName: true } },
          class: { select: { name: true } },
          section: { select: { name: true } },
        },
      },
    },
  });
  if (!deposit) return Response.json({ error: 'Entry not found' }, { status: 404 });
  if (deposit.type !== 'DEPOSIT') {
    return Response.json({ error: 'Receipts are only available for deposit entries' }, { status: 400 });
  }
  if (deposit.voidedAt) {
    return Response.json({ error: 'This deposit is voided' }, { status: 400 });
  }

  // Walk all non-voided entries chronologically up to and including this deposit
  // and replay FIFO to determine which charges this specific deposit paid against.
  const allEntries = await prisma.feeLedger.findMany({
    where: { studentId: deposit.studentId, voidedAt: null },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });

  type Charge = { id: string; month: string; description: string; category: string | null; amount: number; remaining: number };
  const charges: Charge[] = [];
  const allocation: { chargeId: string; month: string; description: string; category: string | null; amountPaid: number }[] = [];
  let balanceBefore = 0;
  let balanceAfter = 0;
  let foundDeposit = false;

  for (const e of allEntries) {
    if (e.id === deposit.id) {
      // Pre-allocation balance
      balanceBefore = balanceAfter;
      // Allocate this deposit FIFO to outstanding charges
      let pool = e.amount;
      for (const c of charges) {
        if (pool <= 0) break;
        if (c.remaining <= 0) continue;
        const take = Math.min(pool, c.remaining);
        c.remaining -= take;
        allocation.push({
          chargeId: c.id, month: c.month, description: c.description,
          category: c.category, amountPaid: take,
        });
        pool -= take;
      }
      balanceAfter -= e.amount;
      foundDeposit = true;
      break;
    }
    if (e.type === 'CHARGE') {
      charges.push({
        id: e.id, month: e.month, description: e.description,
        category: e.category, amount: e.amount, remaining: e.amount,
      });
      balanceAfter += e.amount;
    } else if (e.type === 'DEPOSIT') {
      // Earlier deposit — apply FIFO so charge.remaining is accurate
      let pool = e.amount;
      for (const c of charges) {
        if (pool <= 0) break;
        if (c.remaining <= 0) continue;
        const take = Math.min(pool, c.remaining);
        c.remaining -= take;
        pool -= take;
      }
      balanceAfter -= e.amount;
    }
  }

  if (!foundDeposit) {
    return Response.json({ error: 'Could not locate deposit in ledger sequence' }, { status: 500 });
  }

  // Latest balance overall (including entries after this deposit)
  const latest = await prisma.feeLedger.findFirst({
    where: { studentId: deposit.studentId, voidedAt: null },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    select: { balanceAfter: true },
  });

  // School / settings header (best-effort)
  const schoolNameSetting = await prisma.schoolSettings.findUnique({ where: { key: 'schoolName' } });
  const schoolName = schoolNameSetting?.value || 'PATHAK EDUCATIONAL FOUNDATION SCHOOL';

  return Response.json({
    deposit: {
      id: deposit.id,
      date: deposit.date,
      month: deposit.month,
      amount: deposit.amount,
      paymentMethod: deposit.paymentMethod,
      receivedBy: deposit.receivedBy,
      receiptNumber: deposit.receiptNumber,
      description: deposit.description,
    },
    student: {
      id: deposit.student.id,
      admissionNo: deposit.student.admissionNo,
      name: `${deposit.student.user.firstName} ${deposit.student.user.lastName}`.trim(),
      class: deposit.student.class?.name,
      section: deposit.student.section?.name,
    },
    allocation,
    balanceBeforeDeposit: balanceBefore,
    balanceAfterDeposit: balanceAfter,
    currentBalance: latest?.balanceAfter ?? balanceAfter,
    schoolName,
  });
}
