// One-off: existing expenses predate the paid/unpaid feature and were all
// assumed paid. Set paidAmount = amount, status = PAID for any not yet marked.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const all = await prisma.expense.findMany();
  let n = 0;
  for (const e of all) {
    // Only touch rows still at the default (paidAmount 0 but assumed paid)
    if (e.paidAmount === 0 && e.status === 'PAID') {
      await prisma.expense.update({
        where: { id: e.id },
        data: { paidAmount: e.amount, paidDate: e.date },
      });
      n++;
    }
  }
  console.log(`Backfilled ${n} of ${all.length} expenses as fully paid`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
