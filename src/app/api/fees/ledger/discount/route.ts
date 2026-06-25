import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { recomputeStudentLedger } from '@/lib/feeLedger';
import { requireScope } from '@/lib/apiAuth';

// POST /api/fees/ledger/discount
// Body: {
//   studentId: string,
//   amount: number,         // positive — the discount value
//   month?: string,         // YYYY-MM (default: current month)
//   category?: string,      // SIBLING_DISCOUNT, MERIT_DISCOUNT, FEE_WAIVER, AD_HOC (default: AD_HOC)
//   reason: string,         // required free-text explanation
// }
// Creates a DISCOUNT ledger entry. Discounts reduce the running balance
// like a deposit, but show on the receipt as a discount line, not a payment.
// Allocation is FIFO: oldest unpaid charge gets the discount first.
export async function POST(request: NextRequest) {
  const auth = await requireScope(request, 'fees');
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const { studentId, amount, month, category, reason } = body;

  if (!studentId) return Response.json({ error: 'studentId is required' }, { status: 400 });
  const amt = Number(amount);
  if (!amt || amt <= 0) return Response.json({ error: 'amount must be positive' }, { status: 400 });
  if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
    return Response.json({ error: 'reason is required (min 3 chars) — discounts must be auditable' }, { status: 400 });
  }

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });

  const now = new Date();
  const targetMonth = month && /^\d{4}-\d{2}$/.test(month)
    ? month
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Date the discount the same way a deposit is dated: use the explicit entryDate
  // (so a discount collected alongside a deposit sits at the same point in the
  // ledger and FIFO settles them together), else fall back to the 1st of the month.
  const parsedEntry = body.entryDate ? new Date(body.entryDate) : null;
  const fallback = new Date(targetMonth + '-01T00:00:00Z');
  const discountDate = parsedEntry && !isNaN(parsedEntry.getTime())
    ? parsedEntry
    : (isNaN(fallback.getTime()) ? now : fallback);

  const entry = await prisma.feeLedger.create({
    data: {
      studentId,
      month: targetMonth,
      date: discountDate,
      type: 'DISCOUNT',
      category: category || 'AD_HOC',
      description: `Discount: ${reason.trim()}`,
      amount: amt,
      balanceAfter: 0,
    },
  });

  const { balance } = await recomputeStudentLedger(studentId);

  return Response.json({ entry, currentBalance: balance }, { status: 201 });
}
