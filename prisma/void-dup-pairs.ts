// Void the duplicate (later) row of each confirmed double-submit pair. Keeps
// the earliest row, soft-voids the rest with an audit entry (reversible from
// the UI's "Show voided entries"), then recomputes affected balances.
import { PrismaClient } from '@prisma/client';
import { recomputeStudentLedger, writeFeeLedgerAudit } from '../src/lib/feeLedger';
const prisma = new PrismaClient();

const groups = [
  { studentId: '162cbf55-bdb0-40df-975a-8d210e1ba0d8', month: '2026-04', type: 'DEPOSIT', category: 'DEPOSIT', amount: 4000 },
  { studentId: '185f8eda-9496-495e-a08f-1b275f78630b', month: '2024-04', type: 'CHARGE', category: 'PREVIOUS_BALANCE', amount: 215 },
  { studentId: '4b53b18d-dc3c-4a8b-ab0e-80ddfd1040a3', month: '2026-06', type: 'DEPOSIT', category: 'DEPOSIT', amount: 1000 },
];

function snap(e: any) {
  return { id: e.id, type: e.type, category: e.category, description: e.description, amount: e.amount, month: e.month, date: e.date, receiptNumber: e.receiptNumber };
}

async function main() {
  const affected = new Set<string>();
  for (const g of groups) {
    const rows = await prisma.feeLedger.findMany({
      where: { studentId: g.studentId, month: g.month, type: g.type, category: g.category, amount: g.amount, voidedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    // keep first, void the rest
    for (const e of rows.slice(1)) {
      const voided = await prisma.feeLedger.update({
        where: { id: e.id },
        data: { voidedAt: new Date(), voidedBy: 'SYSTEM', voidReason: 'Duplicate (double-submit) removed' },
      });
      await writeFeeLedgerAudit({
        entryId: e.id, studentId: g.studentId, action: 'VOID',
        before: snap(e), after: snap(voided), userName: 'SYSTEM', reason: 'Duplicate (double-submit) removed',
      });
      affected.add(g.studentId);
      console.log(`Voided duplicate ${g.category} ₹${g.amount} for ${g.studentId} (${e.receiptNumber || 'no receipt'})`);
    }
  }
  for (const sid of affected) await recomputeStudentLedger(sid);
  console.log(`\nDone — voided ${affected.size ? '' : 'nothing, '}recomputed ${affected.size} students.`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
