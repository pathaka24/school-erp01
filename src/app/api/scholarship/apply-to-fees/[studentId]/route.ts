import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { recomputeStudentLedger } from '@/lib/feeLedger';
import { requireScope } from '@/lib/apiAuth';

// POST /api/scholarship/apply-to-fees/[studentId]
// Body: { amount: number, month?: 'YYYY-MM', reason?: string }
//
// Applies a scholarship to a student's fees: creates a SCHOLARSHIP discount in
// the FeeLedger (reduces what the parent owes, FIFO) AND records it in the
// scholarship wallet/ledger as a CREDIT so the student's scholarship history is
// kept. This is the bridge between the (previously stand-alone) scholarship
// system and the real fee ledger.
export async function POST(request: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const auth = await requireScope(request, 'scholarship');
  if (auth instanceof Response) return auth;

  const { studentId } = await params;
  const body = await request.json();
  const amount = Number(body.amount);
  if (!amount || amount <= 0) return Response.json({ error: 'amount must be positive' }, { status: 400 });

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });

  const now = new Date();
  const month = body.month && /^\d{4}-\d{2}$/.test(body.month)
    ? body.month
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const reason = (body.reason || 'Scholarship').toString().trim();
  const entryDate = new Date(month + '-01T00:00:00Z');
  const monthLabel = new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // Eligibility: scholarship is only for students who actually pay their fees.
  // Require the monthly fee for this month to be covered by real deposits
  // (cash in), not by other discounts. Admin can override with allowUnpaid.
  if (!body.allowUnpaid) {
    const [monthlyFee, depositsAgg] = await Promise.all([
      prisma.feeLedger.findFirst({ where: { studentId, month, type: 'CHARGE', category: 'MONTHLY_FEE', voidedAt: null, archivedAt: null }, select: { amount: true } }),
      prisma.feeLedger.aggregate({ where: { studentId, month, type: 'DEPOSIT', voidedAt: null, archivedAt: null }, _sum: { amount: true } }),
    ]);
    const feeAmt = monthlyFee?.amount || 0;
    const paid = depositsAgg._sum.amount || 0;
    if (feeAmt > 0 && paid + 0.5 < feeAmt) {
      return Response.json({
        error: `Scholarship not allowed — monthly fee for ${monthLabel} isn't paid (deposited ₹${Math.round(paid)} of ₹${Math.round(feeAmt)}). Collect the fee first.`,
        needsPayment: true, paid, due: feeAmt,
      }, { status: 422 });
    }
  }

  // 1) Fee-ledger discount (SCHOLARSHIP) — reduces the balance like a payment, FIFO
  await prisma.feeLedger.create({
    data: {
      studentId, month,
      date: isNaN(entryDate.getTime()) ? now : entryDate,
      type: 'DISCOUNT',
      category: 'SCHOLARSHIP',
      description: `Scholarship: ${reason}`,
      amount,
      balanceAfter: 0,
    },
  });
  const { balance: feeBalance } = await recomputeStudentLedger(studentId);

  // 2) Record in the scholarship wallet/ledger as a CREDIT (lifetime scholarship)
  const wallet = await prisma.scholarshipWallet.upsert({
    where: { studentId },
    update: {},
    create: { studentId, balance: 0, tier: 'NONE' },
  });
  const newWalletBalance = wallet.balance + amount;
  await prisma.$transaction([
    prisma.scholarshipTransaction.create({
      data: { studentId, type: 'CREDIT', amount, balance: newWalletBalance, description: `Applied to fees: ${reason}`, month },
    }),
    prisma.scholarshipWallet.update({ where: { studentId }, data: { balance: newWalletBalance } }),
  ]);

  return Response.json({ message: 'Scholarship applied to fees', amount, feeBalance, walletBalance: newWalletBalance }, { status: 201 });
}
