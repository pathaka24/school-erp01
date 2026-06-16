// Inspect the 3 suspected duplicate pairs: show each row's createdAt + date so
// we can tell double-submit artifacts (near-identical timestamps) from genuine
// repeat entries (far apart).
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const groups = [
  { studentId: '162cbf55-bdb0-40df-975a-8d210e1ba0d8', month: '2026-04', type: 'DEPOSIT', category: 'DEPOSIT', amount: 4000 },
  { studentId: '185f8eda-9496-495e-a08f-1b275f78630b', month: '2024-04', type: 'CHARGE', category: 'PREVIOUS_BALANCE', amount: 215 },
  { studentId: '4b53b18d-dc3c-4a8b-ab0e-80ddfd1040a3', month: '2026-06', type: 'DEPOSIT', category: 'DEPOSIT', amount: 1000 },
];

async function main() {
  for (const g of groups) {
    const rows = await prisma.feeLedger.findMany({
      where: { studentId: g.studentId, month: g.month, type: g.type, category: g.category, amount: g.amount, voidedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true, date: true, receiptNumber: true },
    });
    const student = await prisma.student.findUnique({ where: { id: g.studentId }, include: { user: { select: { firstName: true, lastName: true } } } });
    console.log(`\n${student?.user.firstName} ${student?.user.lastName} — ${g.category} ₹${g.amount} (${g.month}), ${rows.length} rows:`);
    let prev: Date | null = null;
    for (const r of rows) {
      const gap = prev ? `  (+${Math.round((r.createdAt.getTime() - prev.getTime()) / 1000)}s after previous)` : '';
      console.log(`   ${r.createdAt.toISOString()}  receipt=${r.receiptNumber || '—'}${gap}`);
      prev = r.createdAt;
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
