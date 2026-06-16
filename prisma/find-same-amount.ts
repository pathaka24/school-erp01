// Find students with 2+ non-voided CHARGE rows in the same month with the same
// amount — catches "1150 apr, 1150 apr" even when category/description differ.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.feeLedger.findMany({
    where: { voidedAt: null, type: 'CHARGE' },
    select: { studentId: true, month: true, amount: true, category: true, description: true, createdAt: true },
  });
  const groups = new Map<string, any[]>();
  for (const r of rows) {
    const k = `${r.studentId}|${r.month}|${r.amount}`;
    const list = groups.get(k) || [];
    list.push(r);
    groups.set(k, list);
  }
  const dups = [...groups.entries()].filter(([, list]) => list.length > 1);
  console.log(`Same student+month+amount charge groups with 2+ rows: ${dups.length}`);
  for (const [k, list] of dups.slice(0, 30)) {
    const [sid] = k.split('|');
    const s = await prisma.student.findUnique({ where: { id: sid }, include: { user: { select: { firstName: true, lastName: true } } } });
    console.log(`\n${s?.user.firstName} ${s?.user.lastName} — ${k}`);
    for (const r of list) {
      console.log(`   ${r.category} | "${r.description}" | ${r.createdAt.toISOString()}`);
    }
  }
  if (dups.length === 0) console.log('None found.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
