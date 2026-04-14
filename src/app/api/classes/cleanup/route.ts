import { prisma } from '@/lib/db';

// GET /api/classes/cleanup — find and remove duplicate/wrongly-named classes
// Keeps "Class X" format, removes "Grade X" or other duplicates
export async function GET() {
  const classes = await prisma.class.findMany({
    include: { _count: { select: { students: true, sections: true } } },
    orderBy: { numericGrade: 'asc' },
  });

  // Find duplicates by numericGrade
  const gradeMap = new Map<number, typeof classes>();
  for (const cls of classes) {
    if (!gradeMap.has(cls.numericGrade)) gradeMap.set(cls.numericGrade, []);
    gradeMap.get(cls.numericGrade)!.push(cls);
  }

  const duplicates: any[] = [];
  const toDelete: string[] = [];

  for (const [grade, classList] of gradeMap) {
    if (classList.length > 1) {
      // Keep the one named "Class X", delete others
      const keep = classList.find(c => c.name.startsWith('Class ')) || classList[0];
      for (const cls of classList) {
        if (cls.id !== keep.id) {
          duplicates.push({ grade, keep: keep.name, remove: cls.name, removeId: cls.id, students: cls._count.students });
          if (cls._count.students === 0) toDelete.push(cls.id);
        }
      }
    }
  }

  // Also find classes with wrong names (not "Class X")
  const wrongNames = classes.filter(c => !c.name.match(/^Class \d+$/));

  return Response.json({
    totalClasses: classes.length,
    duplicates,
    wrongNames: wrongNames.map(c => ({ id: c.id, name: c.name, grade: c.numericGrade, students: c._count.students })),
    safeToDelete: toDelete,
    message: `Found ${duplicates.length} duplicates, ${wrongNames.length} wrong names. Use POST to fix.`,
  });
}

// POST /api/classes/cleanup — actually fix the duplicates
export async function POST() {
  const classes = await prisma.class.findMany({
    include: { _count: { select: { students: true, sections: true } }, students: { select: { id: true } }, sections: { select: { id: true } } },
    orderBy: { numericGrade: 'asc' },
  });

  const gradeMap = new Map<number, typeof classes>();
  for (const cls of classes) {
    if (!gradeMap.has(cls.numericGrade)) gradeMap.set(cls.numericGrade, []);
    gradeMap.get(cls.numericGrade)!.push(cls);
  }

  let fixed = 0;
  let deleted = 0;
  let renamed = 0;

  for (const [grade, classList] of gradeMap) {
    if (classList.length > 1) {
      // Keep the one named "Class X" first, or the one with most students
      const keep = classList.find(c => c.name === `Class ${grade}`)
        || classList.sort((a, b) => b._count.students - a._count.students)[0];

      for (const cls of classList) {
        if (cls.id === keep.id) continue;

        // Move students
        if (cls.students.length > 0) {
          const targetSection = keep.sections[0];
          if (targetSection) {
            await prisma.student.updateMany({ where: { classId: cls.id }, data: { classId: keep.id, sectionId: targetSection.id } });
            fixed += cls.students.length;
          }
        }

        // Move fee structures
        await prisma.feeStructure.updateMany({ where: { classId: cls.id }, data: { classId: keep.id } }).catch(() => {});
        // Move subjects
        await prisma.subject.updateMany({ where: { classId: cls.id }, data: { classId: keep.id } }).catch(() => {});
        // Move exams
        await prisma.exam.updateMany({ where: { classId: cls.id }, data: { classId: keep.id } }).catch(() => {});
        // Move timetable
        await prisma.timetable.updateMany({ where: { classId: cls.id }, data: { classId: keep.id } }).catch(() => {});

        // Delete sections of duplicate (cascade should handle timetable slots)
        for (const section of cls.sections) {
          // Move any remaining students from this section
          await prisma.student.updateMany({ where: { sectionId: section.id }, data: { classId: keep.id, sectionId: keep.sections[0]?.id || section.id } }).catch(() => {});
          await prisma.timetable.deleteMany({ where: { sectionId: section.id } }).catch(() => {});
          await prisma.section.delete({ where: { id: section.id } }).catch(() => {});
        }

        // Delete the duplicate class
        try {
          await prisma.class.delete({ where: { id: cls.id } });
          deleted++;
        } catch (err: any) {
          // Force: delete all remaining relations then try again
          await prisma.feeStructure.deleteMany({ where: { classId: cls.id } }).catch(() => {});
          await prisma.subject.deleteMany({ where: { classId: cls.id } }).catch(() => {});
          await prisma.exam.deleteMany({ where: { classId: cls.id } }).catch(() => {});
          await prisma.timetable.deleteMany({ where: { classId: cls.id } }).catch(() => {});
          try {
            await prisma.class.delete({ where: { id: cls.id } });
            deleted++;
          } catch {
            // Last resort — just rename so it's obvious
            await prisma.class.update({ where: { id: cls.id }, data: { name: `DELETE_${cls.name}` } }).catch(() => {});
          }
        }
      }

      // Ensure the kept class has the right name
      const correctName = `Class ${grade}`;
      if (keep.name !== correctName) {
        await prisma.class.update({ where: { id: keep.id }, data: { name: correctName } });
        renamed++;
      }
    } else {
      // Single class — just ensure correct name
      const cls = classList[0];
      const correctName = `Class ${grade}`;
      if (cls.name !== correctName) {
        await prisma.class.update({ where: { id: cls.id }, data: { name: correctName } });
        renamed++;
      }
    }
  }

  return Response.json({
    message: 'Cleanup complete',
    duplicatesDeleted: deleted,
    studentsReassigned: fixed,
    classesRenamed: renamed,
  });
}
