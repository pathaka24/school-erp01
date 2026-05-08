import { prisma } from '@/lib/db';

// Single source of truth for ledger consistency. Walks all non-voided entries
// for a student in chronological order and updates two persisted fields:
//
//   - balanceAfter: running balance (charges − deposits) after each entry
//   - paidAmount:   for CHARGE rows, how much has been paid via FIFO from
//                   subsequent deposits. For DEPOSIT rows, always 0.
//
// Voided entries are skipped entirely (their row stays in the DB with
// voidedAt set; balances behave as if they never existed).
//
// Call this after every create / update / void on a student's ledger so the
// stored fields stay consistent without recomputing on read.
export async function recomputeStudentLedger(studentId: string) {
  const entries = await prisma.feeLedger.findMany({
    where: { studentId, voidedAt: null },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });

  // FIFO state
  const chargeRemaining = new Map<string, number>(); // entryId -> remaining unpaid
  const finalPaid = new Map<string, number>();       // entryId -> total paid (initially amount)
  let balance = 0;

  // Per-entry running balance
  const balanceUpdates: { id: string; balanceAfter: number }[] = [];

  for (const e of entries) {
    if (e.type === 'CHARGE') {
      chargeRemaining.set(e.id, e.amount);
      finalPaid.set(e.id, 0);
      balance += e.amount;
    } else if (e.type === 'DEPOSIT' || e.type === 'DISCOUNT') {
      // Both deposits and discounts reduce what the student owes.
      // Discounts are applied FIFO too — they "pay off" the oldest charge first
      // so the receipt makes sense ("discount applied against monthly fee").
      let pool = e.amount;
      for (const [chargeId, remaining] of chargeRemaining) {
        if (pool <= 0) break;
        if (remaining <= 0) continue;
        const take = Math.min(pool, remaining);
        chargeRemaining.set(chargeId, remaining - take);
        finalPaid.set(chargeId, (finalPaid.get(chargeId) || 0) + take);
        pool -= take;
      }
      balance -= e.amount;
    }

    balanceUpdates.push({ id: e.id, balanceAfter: balance });
  }

  // Persist changes only where they differ
  await prisma.$transaction(async tx => {
    for (const u of balanceUpdates) {
      const entry = entries.find(e => e.id === u.id)!;
      const expectedPaid = entry.type === 'CHARGE' ? (finalPaid.get(entry.id) ?? 0) : 0;
      const balanceChanged = Math.abs(entry.balanceAfter - u.balanceAfter) > 0.01;
      const paidChanged = Math.abs(entry.paidAmount - expectedPaid) > 0.01;
      if (!balanceChanged && !paidChanged) continue;
      await tx.feeLedger.update({
        where: { id: u.id },
        data: {
          ...(balanceChanged ? { balanceAfter: u.balanceAfter } : {}),
          ...(paidChanged ? { paidAmount: expectedPaid } : {}),
        },
      });
    }
  });

  return { balance, entriesProcessed: entries.length };
}

// Write an audit row for a ledger entry change.
export async function writeFeeLedgerAudit(args: {
  entryId: string;
  studentId: string;
  action: 'CREATE' | 'UPDATE' | 'VOID' | 'RESTORE';
  before?: any;
  after?: any;
  userId?: string;
  userName?: string;
  reason?: string;
}) {
  await prisma.feeLedgerAudit.create({
    data: {
      entryId: args.entryId,
      studentId: args.studentId,
      action: args.action,
      before: args.before ? JSON.stringify(args.before) : null,
      after: args.after ? JSON.stringify(args.after) : null,
      userId: args.userId || null,
      userName: args.userName || null,
      reason: args.reason || null,
    },
  });
}
