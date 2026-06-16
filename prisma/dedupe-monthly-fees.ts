// One-off: remove duplicate auto-generated MONTHLY_FEE rows created by the
// concurrent-load race (before the deterministic-id fix). Keeps the oldest
// monthly-fee row per (student, month), deletes the extras, and recomputes
// each affected student's ledger so balances are correct.
import { PrismaClient } from '@prisma/client';
import { recomputeStudentLedger } from '../src/lib/feeLedger';

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.feeLedger.findMany({
    where: { type: 'CHARGE', category: 'MONTHLY_FEE', voidedAt: null },
    orderBy: [{ createdAt: 'asc' }],
    select: { id: true, studentId: true, month: true, amount: true },
  });

  // Group by student|month, keep first, mark rest for deletion
  const seen = new Set<string>();
  const toDelete: string[] = [];
  const affected = new Set<string>();
  for (const r of rows) {
    const key = `${r.studentId}|${r.month}`;
    if (seen.has(key)) {
      toDelete.push(r.id);
      affected.add(r.studentId);
    } else {
      seen.add(key);
    }
  }

  if (toDelete.length === 0) {
    console.log('No duplicate monthly fees found.');
    return;
  }

  // Remove any audit rows pointing at the deleted entries, then delete them
  await prisma.feeLedgerAudit.deleteMany({ where: { entryId: { in: toDelete } } });
  const del = await prisma.feeLedger.deleteMany({ where: { id: { in: toDelete } } });
  console.log(`Deleted ${del.count} duplicate monthly-fee rows across ${affected.size} students.`);

  for (const sid of affected) await recomputeStudentLedger(sid);
  console.log('Recomputed ledgers for affected students.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
