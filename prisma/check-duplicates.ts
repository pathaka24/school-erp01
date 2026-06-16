// Verification: report any duplicate non-voided ledger entries.
// Two kinds:
//  1. Monthly fees: more than one MONTHLY_FEE per (student, month)
//  2. General: identical (student, month, type, category, description, amount)
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.feeLedger.findMany({
    where: { voidedAt: null },
    select: { id: true, studentId: true, month: true, type: true, category: true, description: true, amount: true },
  });

  const monthly = new Map<string, number>();
  const general = new Map<string, number>();
  for (const r of rows) {
    if (r.type === 'CHARGE' && r.category === 'MONTHLY_FEE') {
      const k = `${r.studentId}|${r.month}`;
      monthly.set(k, (monthly.get(k) || 0) + 1);
    }
    const gk = `${r.studentId}|${r.month}|${r.type}|${r.category}|${r.description}|${r.amount}`;
    general.set(gk, (general.get(gk) || 0) + 1);
  }

  const dupMonthly = [...monthly.entries()].filter(([, n]) => n > 1);
  const dupGeneral = [...general.entries()].filter(([, n]) => n > 1);

  console.log(`Total non-voided entries: ${rows.length}`);
  console.log(`Duplicate monthly fees (student|month): ${dupMonthly.length}`);
  dupMonthly.forEach(([k, n]) => console.log(`   ${k} ×${n}`));
  console.log(`Duplicate identical entries: ${dupGeneral.length}`);
  dupGeneral.slice(0, 20).forEach(([k, n]) => console.log(`   ${k} ×${n}`));

  if (dupMonthly.length === 0 && dupGeneral.length === 0) {
    console.log('\n✓ No duplicates — clean.');
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
