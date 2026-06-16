// Check the two April 2026 ₹1250 MONTHLY_FEE rows — are they the same student
// (a real duplicate) or two different siblings (family view showing both)?
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.feeLedger.findMany({
    where: { month: '2026-04', type: 'CHARGE', category: 'MONTHLY_FEE', amount: 1250, voidedAt: null },
    select: { id: true, studentId: true, description: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Found ${rows.length} April ₹1250 monthly-fee rows:\n`);
  for (const r of rows) {
    const s = await prisma.student.findUnique({
      where: { id: r.studentId },
      include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } },
    });
    console.log(`  ${s?.user.firstName} ${s?.user.lastName} (${s?.class?.name}) — studentId=${r.studentId.slice(0, 8)} — created ${r.createdAt.toISOString()}`);
  }
  const uniqueStudents = new Set(rows.map(r => r.studentId));
  console.log(`\nDistinct students: ${uniqueStudents.size} — ${uniqueStudents.size === rows.length ? 'one per student (NOT a duplicate, just family view)' : 'SAME student appears twice (real duplicate)'}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
