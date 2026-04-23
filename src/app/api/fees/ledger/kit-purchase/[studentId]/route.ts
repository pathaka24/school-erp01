import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// POST /api/fees/ledger/kit-purchase/[studentId]
// Body: { items: [{ category, description, amount }], deposit?: { amount, paymentMethod, receivedBy } }
// Creates multiple CHARGE entries in one transaction and an optional DEPOSIT,
// recalculates balance, returns a printable receipt payload.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  const body = await request.json();
  const { items, deposit, discount } = body as {
    items: { category: string; description: string; amount: number }[];
    deposit?: { amount: number; paymentMethod: string; receivedBy?: string };
    discount?: { amount: number; reason?: string };
  };

  if (!Array.isArray(items) || items.length === 0) {
    return Response.json({ error: 'items array is required' }, { status: 400 });
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } }, section: { select: { name: true } } },
  });
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });

  // Start balance from last ledger entry
  const lastEntry = await prisma.feeLedger.findFirst({
    where: { studentId },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    select: { balanceAfter: true },
  });
  let balance = lastEntry?.balanceAfter ?? 0;

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const receiptNumber = `RCP-KIT-${student.admissionNo}-${Date.now().toString().slice(-6)}`;

  const charges = [];
  let totalCharged = 0;
  for (const item of items) {
    const amount = parseFloat(String(item.amount)) || 0;
    if (amount <= 0) continue;
    balance += amount;
    totalCharged += amount;
    const entry = await prisma.feeLedger.create({
      data: {
        studentId,
        date: now,
        month,
        type: 'CHARGE',
        category: item.category || 'AD_HOC',
        description: item.description || String(item.category || 'Item').replace(/_/g, ' '),
        amount,
        balanceAfter: balance,
      },
    });
    charges.push(entry);
  }

  // Apply discount as a negative CHARGE row (keeps audit trail, reduces balance)
  let discountEntry = null;
  let discountAmount = 0;
  if (discount && discount.amount && parseFloat(String(discount.amount)) > 0) {
    discountAmount = Math.min(parseFloat(String(discount.amount)), totalCharged);
    balance -= discountAmount;
    discountEntry = await prisma.feeLedger.create({
      data: {
        studentId,
        date: now,
        month,
        type: 'CHARGE',
        category: 'DISCOUNT',
        description: `Discount${discount.reason ? ` — ${discount.reason}` : ''}`,
        amount: -discountAmount,
        balanceAfter: balance,
      },
    });
  }

  let depositEntry = null;
  let totalPaid = 0;
  if (deposit && deposit.amount && parseFloat(String(deposit.amount)) > 0) {
    totalPaid = parseFloat(String(deposit.amount));
    balance -= totalPaid;
    depositEntry = await prisma.feeLedger.create({
      data: {
        studentId,
        date: now,
        month,
        type: 'DEPOSIT',
        category: 'DEPOSIT',
        description: `Kit purchase deposit via ${deposit.paymentMethod || 'CASH'}`,
        amount: totalPaid,
        balanceAfter: balance,
        paymentMethod: deposit.paymentMethod || 'CASH',
        receiptNumber,
        receivedBy: deposit.receivedBy || null,
      },
    });
  }

  return Response.json({
    charges,
    discount: discountEntry,
    deposit: depositEntry,
    receiptNumber,
    totalCharged,
    discountAmount,
    netCharged: totalCharged - discountAmount,
    totalPaid,
    balanceAfter: balance,
    student: {
      id: student.id,
      admissionNo: student.admissionNo,
      name: `${student.user.firstName} ${student.user.lastName}`.trim(),
      className: student.class?.name,
      sectionName: student.section?.name,
    },
  }, { status: 201 });
}
