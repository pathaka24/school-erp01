// Full April 2026 picture for Saurya Mishra's family — every MONTHLY_FEE row
// (any amount, incl. voided) so we can see exactly what the ledger holds.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const saurya = await prisma.student.findFirst({
    where: { user: { firstName: { contains: 'Saurya' } } },
    select: { id: true, familyId: true },
  });
  if (!saurya) { console.log('Saurya not found'); return; }
  console.log('Saurya id:', saurya.id, 'familyId:', saurya.familyId);

  const family = saurya.familyId
    ? await prisma.student.findMany({ where: { familyId: saurya.familyId }, include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } })
    : [saurya];
  console.log('\nFamily members:');
  for (const m of family) console.log(`  ${(m as any).user?.firstName} ${(m as any).user?.lastName} (${(m as any).class?.name}) — ${m.id}`);

  const ids = family.map(m => m.id);
  const apr = await prisma.feeLedger.findMany({
    where: { studentId: { in: ids }, month: '2026-04', type: 'CHARGE', category: 'MONTHLY_FEE' },
    select: { id: true, studentId: true, amount: true, description: true, voidedAt: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`\nApril 2026 MONTHLY_FEE rows for this family: ${apr.length}`);
  for (const r of apr) {
    console.log(`  id=${r.id}  student=${r.studentId.slice(0,8)}  ₹${r.amount}  "${r.description}"  ${r.voidedAt ? 'VOIDED' : 'active'}  ${r.createdAt.toISOString()}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
