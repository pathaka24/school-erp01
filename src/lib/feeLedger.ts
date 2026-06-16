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

// Marker stored in a voided entry's `voidReason` so a bulk archive can later be
// selectively restored without disturbing entries that were voided manually for
// other reasons (a one-off correction, a duplicate charge, etc.).
export const ARCHIVE_VOID_TAG = '[ARCHIVED]';

function ledgerSnapshot(e: any) {
  return {
    id: e.id, type: e.type, category: e.category, description: e.description,
    amount: e.amount, month: e.month, date: e.date,
    paymentMethod: e.paymentMethod, receivedBy: e.receivedBy, receiptNumber: e.receiptNumber,
    voidedAt: e.voidedAt, voidedBy: e.voidedBy, voidReason: e.voidReason,
  };
}

// Soft-archive a student's entire fee ledger by voiding every active entry.
// Nothing is deleted — rows stay in the DB with voidedAt set, drop out of all
// reports (which filter on voidedAt: null), and are recoverable via
// restoreStudentLedger. Each void writes a VOID audit row. Used when a student
// is deleted (opt-in) and from the finance dashboard's archive action.
export async function archiveStudentLedger(
  studentId: string,
  opts: { actor?: string; reason?: string } = {}
) {
  const actor = opts.actor || null;
  const reason = `${ARCHIVE_VOID_TAG} ${opts.reason || 'Fee records archived'}`.trim();

  const active = await prisma.feeLedger.findMany({
    where: { studentId, voidedAt: null },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  });
  if (active.length === 0) return { archived: 0, currentBalance: 0 };

  const now = new Date();
  for (const e of active) {
    const voided = await prisma.feeLedger.update({
      where: { id: e.id },
      data: { voidedAt: now, voidedBy: actor, voidReason: reason },
    });
    await writeFeeLedgerAudit({
      entryId: e.id, studentId, action: 'VOID',
      before: ledgerSnapshot(e), after: ledgerSnapshot(voided),
      userName: actor || undefined, reason,
    });
  }
  const { balance } = await recomputeStudentLedger(studentId);
  return { archived: active.length, currentBalance: balance };
}

// Restore a previously archived ledger. Only un-voids entries that were voided
// by an archive (tagged with ARCHIVE_VOID_TAG) — manually voided entries are
// left untouched. Writes a RESTORE audit row per entry.
export async function restoreStudentLedger(
  studentId: string,
  opts: { actor?: string } = {}
) {
  const actor = opts.actor || null;
  const archived = await prisma.feeLedger.findMany({
    where: { studentId, voidedAt: { not: null }, voidReason: { startsWith: ARCHIVE_VOID_TAG } },
  });
  if (archived.length === 0) return { restored: 0, currentBalance: 0 };

  for (const e of archived) {
    const restored = await prisma.feeLedger.update({
      where: { id: e.id },
      data: { voidedAt: null, voidedBy: null, voidReason: null },
    });
    await writeFeeLedgerAudit({
      entryId: e.id, studentId, action: 'RESTORE',
      before: ledgerSnapshot(e), after: ledgerSnapshot(restored),
      userName: actor || undefined, reason: 'Fee records restored',
    });
  }
  const { balance } = await recomputeStudentLedger(studentId);
  return { restored: archived.length, currentBalance: balance };
}

// Write an audit row for a ledger entry change. Pass `db` to write inside an
// open transaction so the change and its audit row commit (or roll back)
// together — an unaudited mutation should never survive an audit failure.
export async function writeFeeLedgerAudit(args: {
  entryId: string;
  studentId: string;
  action: 'CREATE' | 'UPDATE' | 'VOID' | 'RESTORE';
  before?: any;
  after?: any;
  userId?: string;
  userName?: string;
  reason?: string;
}, db: Pick<typeof prisma, 'feeLedgerAudit'> = prisma) {
  await db.feeLedgerAudit.create({
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

// Period lock: entries whose month is <= the configured lock month are
// read-only — no edit, void, restore, or hard delete. The lock is stored in
// SchoolSettings under 'feeLockMonth' (YYYY-MM) and managed from
// Settings → Annual Fee Plan. Returns null when no valid lock is set.
export async function getFeeLockMonth(): Promise<string | null> {
  const s = await prisma.schoolSettings.findUnique({ where: { key: 'feeLockMonth' } });
  if (!s) return null;
  let v: any = s.value;
  try { v = JSON.parse(s.value); } catch {}
  return typeof v === 'string' && /^\d{4}-\d{2}$/.test(v) ? v : null;
}

// YYYY-MM strings compare correctly as plain strings.
export function isMonthLocked(month: string, lockMonth: string | null): boolean {
  return !!lockMonth && month <= lockMonth;
}
