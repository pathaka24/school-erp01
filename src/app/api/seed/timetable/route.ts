import { prisma } from '@/lib/db';

// Period times (8 periods per day)
const PERIOD_TIMES = [
  { start: '08:00', end: '08:40' }, // I
  { start: '08:40', end: '09:20' }, // II
  { start: '09:20', end: '10:00' }, // III
  { start: '10:15', end: '10:55' }, // IV (after break)
  { start: '10:55', end: '11:35' }, // V
  { start: '11:35', end: '12:15' }, // VI
  { start: '12:30', end: '01:10' }, // VII (after lunch)
  { start: '01:10', end: '01:50' }, // VIII
];

const DAYS: any[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

// Timetable from PDF — class name → periods (subject, teacher first name)
const TIMETABLE_DATA: Record<string, { subject: string; teacher: string }[]> = {
  'Class 1': [
    { subject: 'Maths', teacher: 'Vini' },
    { subject: 'Hindi', teacher: 'Raushan' },
    { subject: 'English', teacher: 'Deepika' },
    { subject: 'Computer', teacher: 'Deepika' },
    { subject: 'EVS', teacher: 'Vini' },
    { subject: 'English Speaking', teacher: 'Adarsh' },
    { subject: 'Hindi', teacher: 'Vini' },
    { subject: 'Drawing / GK', teacher: 'Raushan' },
  ],
  'Class 2': [
    { subject: 'Hindi', teacher: 'Raushan' },
    { subject: 'Computer', teacher: 'Vini' },
    { subject: 'Maths', teacher: 'Vini' },
    { subject: 'English Speaking', teacher: 'Adarsh' },
    { subject: 'EVS', teacher: 'Priya' },
    { subject: 'English', teacher: 'Deeksha' },
    { subject: 'Computer', teacher: 'Sneha' },
    { subject: 'EVS', teacher: 'Deepika' },
  ],
  'Class 3': [
    { subject: 'English', teacher: 'Deepika' },
    { subject: 'English Speaking', teacher: 'Adarsh' },
    { subject: 'Maths', teacher: 'Sneha' },
    { subject: 'Hindi', teacher: 'Raushan' },
    { subject: 'GK / Drawing', teacher: 'Raushan' },
    { subject: 'Computer', teacher: 'Ajay' },
    { subject: 'Drawing', teacher: 'Ajay' },
  ],
  'Class 4': [
    { subject: 'EVS', teacher: 'Sneha' },
    { subject: 'English', teacher: 'Deepika' },
    { subject: 'Hindi', teacher: 'Raushan' },
    { subject: 'Maths', teacher: 'Sneha' },
    { subject: 'GK / Computer', teacher: 'Ajay' },
    { subject: 'English', teacher: 'Priya' },
    { subject: 'Hindi', teacher: 'Raushan' },
  ],
  'Class 5': [
    { subject: 'Hindi', teacher: 'Himanshu' },
    { subject: 'EVS', teacher: 'Priya' },
    { subject: 'English', teacher: 'Adarsh' },
    { subject: 'Maths', teacher: 'Monika' },
    { subject: 'Drawing', teacher: 'Ajay' },
    { subject: 'English', teacher: 'Adarsh' },
    { subject: 'Science', teacher: 'Monika' },
    { subject: 'English Speaking', teacher: 'Adarsh' },
  ],
  'Class 6': [
    { subject: 'SST', teacher: 'Himanshu' },
    { subject: 'Maths', teacher: 'Monika' },
    { subject: 'Computer / GK', teacher: 'Ajay' },
    { subject: 'English', teacher: 'Priyanshu' },
    { subject: 'English Speaking', teacher: 'Himanshu' },
    { subject: 'Hindi', teacher: 'Deeksha' },
    { subject: 'Science', teacher: 'Monika' },
  ],
  'Class 7': [
    { subject: 'Maths', teacher: 'Monika' },
    { subject: 'English', teacher: 'Priyanshu' },
    { subject: 'Science', teacher: 'Priya' },
    { subject: 'English Speaking', teacher: 'Himanshu' },
    { subject: 'Hindi', teacher: 'Himanshu' },
    { subject: 'SST', teacher: 'Deeksha' },
    { subject: 'English Speaking', teacher: 'Adarsh' },
  ],
  'Class 8': [
    { subject: 'Science', teacher: 'Adarsh' },
    { subject: 'Hindi', teacher: 'Sneha' },
    { subject: 'English', teacher: 'Priyanshu' },
    { subject: 'Computer', teacher: 'Ajay' },
    { subject: 'Science', teacher: 'Priyanshu' },
    { subject: 'Maths', teacher: 'Monika' },
    { subject: 'English Speaking', teacher: 'Himanshu' },
    { subject: 'IT', teacher: 'Ajay' },
  ],
  'Class 9': [
    { subject: 'Science', teacher: 'Priya' },
    { subject: 'English Speaking', teacher: 'Himanshu' },
    { subject: 'Maths', teacher: 'Monika' },
    { subject: 'Hindi', teacher: 'Priya' },
    { subject: 'SST', teacher: 'Deeksha' },
    { subject: 'English', teacher: 'Himanshu' },
    { subject: 'Maths', teacher: 'Priya' },
    { subject: 'IT', teacher: 'Ajay' },
  ],
  'Class 10': [
    { subject: 'Maths', teacher: 'Monika' },
    { subject: 'English Speaking', teacher: 'Himanshu' },
    // Period III is free
    { subject: 'Hindi', teacher: 'Deeksha' },
    { subject: 'SST', teacher: 'Deeksha' },
    { subject: 'English', teacher: 'Priyanshu' },
    // Period VII is free
    { subject: 'IT', teacher: 'Ajay' },
  ],
};

// Class 10 has gaps — map period index to actual period slot
const CLASS10_PERIOD_MAP = [0, 1, 3, 4, 5, 7]; // skip period III (2) and VII (6)

export async function GET() {
  try {
    // Load all classes, sections, teachers
    const classes = await prisma.class.findMany({ include: { sections: true } });
    const teachers = await prisma.teacher.findMany({ include: { user: { select: { firstName: true, lastName: true } } } });

    // Build teacher lookup by first name
    const teacherByName = new Map<string, any>();
    for (const t of teachers) {
      teacherByName.set(t.user.firstName.toLowerCase(), t);
      // Also try with last name
      if (t.user.lastName) {
        teacherByName.set(`${t.user.firstName} ${t.user.lastName}`.toLowerCase(), t);
      }
    }

    // Get or create subjects
    const subjectCache = new Map<string, string>(); // name -> id
    const existingSubjects = await prisma.subject.findMany();
    for (const s of existingSubjects) subjectCache.set(s.name.toLowerCase(), s.id);

    const getOrCreateSubject = async (name: string, classId: string) => {
      // Check by name+class combo
      const key = `${name.toLowerCase()}|${classId}`;
      if (subjectCache.has(key)) return subjectCache.get(key)!;
      // Also check plain name
      if (subjectCache.has(name.toLowerCase())) return subjectCache.get(name.toLowerCase())!;
      // Find existing by name
      const existing = await prisma.subject.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
      if (existing) { subjectCache.set(key, existing.id); subjectCache.set(name.toLowerCase(), existing.id); return existing.id; }
      // Create new
      const code = name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4) + classId.slice(0, 4).toUpperCase();
      const sub = await prisma.subject.create({
        data: { name, code, classId },
      });
      subjectCache.set(key, sub.id);
      subjectCache.set(name.toLowerCase(), sub.id);
      return sub.id;
    };

    // Clear existing timetable
    await prisma.timetable.deleteMany();

    let created = 0;
    let errors: string[] = [];

    for (const [className, periods] of Object.entries(TIMETABLE_DATA)) {
      const cls = classes.find(c => c.name === className);
      if (!cls) { errors.push(`Class not found: ${className}`); continue; }
      const section = cls.sections[0]; // Use section A
      if (!section) { errors.push(`No section for ${className}`); continue; }

      const periodSlots = className === 'Class 10' ? CLASS10_PERIOD_MAP : periods.map((_, i) => i);

      for (let i = 0; i < periods.length; i++) {
        const { subject, teacher: teacherName } = periods[i];
        const slotIndex = periodSlots[i];
        if (slotIndex === undefined || slotIndex >= PERIOD_TIMES.length) continue;

        const time = PERIOD_TIMES[slotIndex];
        const teacherRecord = teacherByName.get(teacherName.toLowerCase());
        if (!teacherRecord) { errors.push(`Teacher not found: ${teacherName} (${className} period ${slotIndex + 1})`); continue; }

        const subjectId = await getOrCreateSubject(subject, cls.id);

        // Create for all weekdays (Mon-Sat)
        for (const day of DAYS) {
          try {
            await prisma.timetable.create({
              data: {
                classId: cls.id,
                sectionId: section.id,
                subjectId,
                teacherId: teacherRecord.id,
                dayOfWeek: day,
                startTime: time.start,
                endTime: time.end,
              },
            });
            created++;
          } catch (err: any) {
            errors.push(`${className} ${day} P${slotIndex + 1}: ${err.message?.slice(0, 50)}`);
          }
        }
      }
    }

    return Response.json({
      message: `${created} timetable entries created across ${DAYS.length} days`,
      periodsPerDay: Object.values(TIMETABLE_DATA).reduce((s, p) => s + p.length, 0),
      totalEntries: created,
      errors: errors.length > 0 ? errors.slice(0, 20) : [],
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
