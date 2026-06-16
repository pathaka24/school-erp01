// One-off (idempotent): add the play section classes NUR / LKG / UKG with
// grade positions -2 / -1 / 0 so promotion order runs NUR → LKG → UKG → Class 1.
// Run with: npx tsx prisma/add-play-classes.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const playClasses = [
    { name: 'NUR', numericGrade: -2 },
    { name: 'LKG', numericGrade: -1 },
    { name: 'UKG', numericGrade: 0 },
  ];

  for (const pc of playClasses) {
    const cls = await prisma.class.upsert({
      where: { name: pc.name },
      update: { numericGrade: pc.numericGrade },
      create: pc,
    });
    const sectionA = await prisma.section.findUnique({
      where: { classId_name: { classId: cls.id, name: 'A' } },
    });
    if (!sectionA) {
      await prisma.section.create({ data: { name: 'A', classId: cls.id } });
    }
    console.log(`✓ ${cls.name} (grade ${cls.numericGrade}) with section A`);
  }

  const all = await prisma.class.findMany({ orderBy: { numericGrade: 'asc' }, select: { name: true, numericGrade: true } });
  console.log('\nClass order:', all.map(c => c.name).join(' → '));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
