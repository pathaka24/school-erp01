import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { recomputeStudentLedger } from '@/lib/feeLedger';
import { requireScope } from '@/lib/apiAuth';

// POST /api/fees/ledger/batch-entry
// Body: {
//   month: 'YYYY-MM',
//   rows: [{
//     studentId: string,
//     monthlyFee?: number,             // creates a MONTHLY_FEE charge if no existing one
//     otherCharge?: { category: string, description: string, amount: number },
//     deposit?: { amount: number, paymentMethod: string, receivedBy?: string, receiptNumber?: string },
//   }]
// }
// For each row:
//   1. If monthlyFee > 0 and student has no MONTHLY_FEE for that month → create one.
//   2. If otherCharge.amount > 0 → create CHARGE entry.
//   3. If deposit.amount > 0 → create DEPOSIT entry.
// Then recalculate running balances for every affected student.
export async function POST(request: NextRequest) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const { month, rows } = body;

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return Response.json({ error: 'month (YYYY-MM) is required' }, { status: 400 });
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return Response.json({ error: 'rows[] is required' }, { status: 400 });
  }

  const entryDate = new Date(month + '-01T00:00:00Z');
  const safeDate = isNaN(entryDate.getTime()) ? new Date() : entryDate;
  const monthLabel = new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const affectedStudents = new Set<string>();
  let chargesCreated = 0;
  let depositsCreated = 0;
  const errors: { studentId: string; reason: string }[] = [];

  for (const row of rows) {
    const { studentId, monthlyFee, otherCharge, deposit } = row || {};
    if (!studentId) continue;

    try {
      // Monthly fee — only create if not already present
      if (monthlyFee && Number(monthlyFee) > 0) {
        const existing = await prisma.feeLedger.findFirst({
          where: { studentId, month, type: 'CHARGE', category: 'MONTHLY_FEE', voidedAt: null },
          select: { id: true },
        });
        if (!existing) {
          await prisma.feeLedger.create({
            data: {
              studentId, month, date: safeDate,
              type: 'CHARGE', category: 'MONTHLY_FEE',
              description: `Monthly Fee - ${monthLabel}`,
              amount: Number(monthlyFee),
              balanceAfter: 0, // recalculated below
            },
          });
          chargesCreated++;
          affectedStudents.add(studentId);
        }
      }

      // Other charge (free-form)
      if (otherCharge && Number(otherCharge.amount) > 0) {
        await prisma.feeLedger.create({
          data: {
            studentId, month, date: safeDate,
            type: 'CHARGE',
            category: otherCharge.category || 'AD_HOC',
            description: otherCharge.description || (otherCharge.category || 'Charge').replace(/_/g, ' '),
            amount: Number(otherCharge.amount),
            balanceAfter: 0,
          },
        });
        chargesCreated++;
        affectedStudents.add(studentId);
      }

      // Deposit
      if (deposit && Number(deposit.amount) > 0) {
        await prisma.feeLedger.create({
          data: {
            studentId, month, date: safeDate,
            type: 'DEPOSIT', category: 'DEPOSIT',
            description: `Deposit via ${deposit.paymentMethod || 'CASH'}`,
            amount: Number(deposit.amount),
            balanceAfter: 0,
            paymentMethod: deposit.paymentMethod || 'CASH',
            receivedBy: deposit.receivedBy || null,
            receiptNumber: deposit.receiptNumber || null,
          },
        });
        depositsCreated++;
        affectedStudents.add(studentId);
      }
    } catch (err: any) {
      errors.push({ studentId, reason: err?.message || 'Unknown error' });
    }
  }

  // Recompute balances + paidAmount (FIFO) for affected students
  for (const sid of affectedStudents) {
    await recomputeStudentLedger(sid);
  }

  return Response.json({
    month,
    monthLabel,
    studentsTouched: affectedStudents.size,
    chargesCreated,
    depositsCreated,
    errors: errors.length ? errors : undefined,
  }, { status: 201 });
}
