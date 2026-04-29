import { PrismaClient, Gender, Category, Stream, AttendanceStatus, ExamType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const firstNamesMale = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Reyansh', 'Sai', 'Arnav',
  'Dhruv', 'Kabir', 'Ritvik', 'Anirudh', 'Ishaan', 'Shaurya', 'Atharv',
  'Advait', 'Pranav', 'Rohan', 'Karthik', 'Manav', 'Nikhil', 'Yash', 'Dev',
  'Harsh', 'Rahul',
];

const firstNamesFemale = [
  'Ananya', 'Diya', 'Myra', 'Sara', 'Aadhya', 'Isha', 'Kavya', 'Anika',
  'Prisha', 'Riya', 'Saanvi', 'Aanya', 'Nisha', 'Pooja', 'Meera', 'Tanya',
  'Sneha', 'Neha', 'Shruti', 'Lavanya', 'Kriti', 'Simran', 'Jiya', 'Avni',
  'Tanvi',
];

const lastNames = [
  'Sharma', 'Patel', 'Reddy', 'Kumar', 'Singh', 'Gupta', 'Verma', 'Joshi',
  'Nair', 'Iyer', 'Rao', 'Mishra', 'Chauhan', 'Mehta', 'Das', 'Malhotra',
  'Kulkarni', 'Pillai', 'Menon', 'Deshmukh', 'Bhat', 'Saxena', 'Kapoor',
  'Tiwari', 'Pandey',
];

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const categories: Category[] = ['GENERAL', 'OBC', 'SC', 'ST'];
const religions = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Jain', 'Buddhist'];
const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Jaipur'];
const states = ['Maharashtra', 'Delhi', 'Karnataka', 'Telangana', 'Tamil Nadu', 'Maharashtra', 'West Bengal', 'Rajasthan'];
const houses = ['Red', 'Blue', 'Green', 'Yellow'];
const occupations = ['Engineer', 'Doctor', 'Teacher', 'Business', 'Lawyer', 'Accountant', 'Government Service', 'Farmer'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(startYear: number, endYear: number): Date {
  const start = new Date(startYear, 0, 1);
  const end = new Date(endYear, 11, 31);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomPhone(): string {
  return '9' + Math.floor(100000000 + Math.random() * 900000000).toString();
}

function randomPincode(): string {
  return (100000 + Math.floor(Math.random() * 900000)).toString();
}

async function main() {
  console.log('Seeding database...');

  // --- Create classes (1-10) with sections A & B ---
  const classData = [];
  for (let grade = 1; grade <= 10; grade++) {
    classData.push({
      name: `Class ${grade}`,
      numericGrade: grade,
    });
  }

  for (const c of classData) {
    await prisma.class.upsert({
      where: { name: c.name },
      update: {},
      create: c,
    });
  }

  const classes = await prisma.class.findMany({ orderBy: { numericGrade: 'asc' } });

  // Create sections A and B for each class
  for (const cls of classes) {
    for (const sectionName of ['A', 'B']) {
      const existing = await prisma.section.findUnique({
        where: { classId_name: { classId: cls.id, name: sectionName } },
      });
      if (!existing) {
        await prisma.section.create({
          data: { name: sectionName, classId: cls.id },
        });
      }
    }
  }

  const sections = await prisma.section.findMany({ include: { class: true } });

  // --- Create 50 students ---
  console.log('Creating 50 students...');

  for (let i = 1; i <= 50; i++) {
    const isFemale = i % 2 === 0;
    const gender: Gender = isFemale ? 'FEMALE' : 'MALE';
    const firstName = isFemale ? pick(firstNamesFemale) : pick(firstNamesMale);
    const lastName = pick(lastNames);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@school.edu`;
    const admissionNo = `ADM-2025-${String(i).padStart(3, '0')}`;

    // Spread students across classes and sections
    const classIndex = Math.floor((i - 1) / 5) % classes.length;
    const cls = classes[classIndex];
    const classSections = sections.filter((s) => s.classId === cls.id);
    const section = classSections[i % classSections.length];

    const cityIndex = Math.floor(Math.random() * cities.length);
    const fatherFirstName = pick(firstNamesMale);
    const motherFirstName = pick(firstNamesFemale);

    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: '$2b$10$placeholder_hash_for_seed_data_only',
        role: 'STUDENT',
        firstName,
        lastName,
        phone: randomPhone(),
        student: {
          create: {
            admissionNo,
            dateOfBirth: randomDate(2010, 2017),
            gender,
            bloodGroup: pick(bloodGroups),
            classId: cls.id,
            sectionId: section.id,
            nationality: 'Indian',
            religion: pick(religions),
            category: pick(categories),
            currentAddress: `${Math.floor(1 + Math.random() * 500)}, ${pick(['MG Road', 'Station Road', 'Gandhi Nagar', 'Nehru Colony', 'Shivaji Nagar'])}`,
            currentCity: cities[cityIndex],
            currentState: states[cityIndex],
            currentPincode: randomPincode(),
            fatherName: `${fatherFirstName} ${lastName}`,
            fatherOccupation: pick(occupations),
            fatherPhone: randomPhone(),
            fatherEmail: `${fatherFirstName.toLowerCase()}.${lastName.toLowerCase()}@gmail.com`,
            motherName: `${motherFirstName} ${lastName}`,
            motherOccupation: pick(occupations),
            motherPhone: randomPhone(),
            admissionDate: randomDate(2023, 2025),
            admittedGrade: `Class ${cls.numericGrade}`,
            house: pick(houses),
            stream: cls.numericGrade >= 9 ? pick(['SCIENCE', 'COMMERCE', 'ARTS'] as Stream[]) : 'NONE',
            rollNumber: String(i),
            annualIncome: Math.floor(200000 + Math.random() * 1800000),
          },
        },
      },
    });

    console.log(`  Created student ${i}/50: ${firstName} ${lastName} (${cls.name} - ${section.name})`);
  }

  // --- Create admin user ---
  console.log('\nCreating admin user...');
  const adminHash = await bcrypt.hash('password123', 12);
  await prisma.user.upsert({
    where: { email: 'admin@school.com' },
    update: { passwordHash: adminHash, isActive: true },
    create: {
      email: 'admin@school.com',
      passwordHash: adminHash,
      role: 'ADMIN',
      firstName: 'Admin',
      lastName: 'User',
      phone: '9000000000',
    },
  });
  console.log('  admin@school.com / password123');

  // --- Create a teacher with subjects and class teacher assignment ---
  console.log('Creating teacher...');
  const teacherHash = await bcrypt.hash('teacher123', 12);
  const teacherUser = await prisma.user.upsert({
    where: { email: 'rahul.sharma@school.com' },
    update: { passwordHash: teacherHash, isActive: true },
    create: {
      email: 'rahul.sharma@school.com',
      passwordHash: teacherHash,
      role: 'TEACHER',
      firstName: 'Rahul',
      lastName: 'Sharma',
      phone: '9876543210',
    },
  });

  const class1 = classes[0]; // Class 1
  const class1Sections = sections.filter((s) => s.classId === class1.id);
  const sectionA = class1Sections.find((s) => s.name === 'A')!;

  const teacherRecord = await prisma.teacher.upsert({
    where: { userId: teacherUser.id },
    update: {},
    create: {
      userId: teacherUser.id,
      employeeId: 'EMP-001',
      qualification: 'M.Ed',
      experience: 8,
    },
  });

  // Assign as class teacher of Class 1 Section A
  await prisma.section.update({
    where: { id: sectionA.id },
    data: { classTeacherId: teacherRecord.id },
  });

  // Create subjects for ALL classes
  const subjectNames = ['Mathematics', 'English', 'Science', 'Hindi', 'Social Studies'];
  for (const cls of classes) {
    for (const subName of subjectNames) {
      const code = `${subName.slice(0, 3).toUpperCase()}-${cls.numericGrade}`;
      await prisma.subject.upsert({
        where: { code },
        update: {},
        create: {
          name: subName,
          code,
          classId: cls.id,
          teacherId: teacherRecord.id,
        },
      });
    }
  }

  console.log('  rahul.sharma@school.com / teacher123 (Class Teacher: Class 1 - A)');

  // ─── FAMILIES (siblings) ─────────────────────────────────
  console.log('\nCreating families with siblings...');
  const allStudents = await prisma.student.findMany({
    include: { user: true, class: true },
    orderBy: { admissionNo: 'asc' },
  });

  // Group pairs of students as siblings (every 2 students with same last name)
  const familyPairs: { name: string; studentIds: string[] }[] = [];
  const usedStudents = new Set<string>();
  for (let i = 0; i < allStudents.length - 1; i++) {
    if (usedStudents.has(allStudents[i].id)) continue;
    for (let j = i + 1; j < allStudents.length; j++) {
      if (usedStudents.has(allStudents[j].id)) continue;
      if (allStudents[i].user.lastName === allStudents[j].user.lastName) {
        familyPairs.push({
          name: `${allStudents[i].user.lastName} Family`,
          studentIds: [allStudents[i].id, allStudents[j].id],
        });
        usedStudents.add(allStudents[i].id);
        usedStudents.add(allStudents[j].id);
        break;
      }
    }
    if (familyPairs.length >= 8) break; // 8 families max
  }

  for (let fi = 0; fi < familyPairs.length; fi++) {
    const fp = familyPairs[fi];
    const family = await prisma.family.create({
      data: {
        familyId: `FAM-2025-${String(fi + 1).padStart(3, '0')}`,
        name: fp.name,
      },
    });
    for (const sid of fp.studentIds) {
      await prisma.student.update({ where: { id: sid }, data: { familyId: family.id } });
    }
    const names = fp.studentIds.map(sid => {
      const s = allStudents.find(st => st.id === sid)!;
      return `${s.user.firstName} (${s.class.name})`;
    });
    console.log(`  ${fp.name}: ${names.join(' + ')}`);
  }

  // ─── FEE STRUCTURES ──────────────────────────────────────
  console.log('\nCreating fee structures...');
  for (const cls of classes) {
    const monthlyAmount = 500 + cls.numericGrade * 50; // Class 1=550, Class 10=1000
    const existingMonthly = await prisma.feeStructure.findFirst({
      where: { classId: cls.id, feeType: 'TUITION', academicYear: '2025-2026' },
    });
    if (!existingMonthly) {
      await prisma.feeStructure.create({
        data: {
          name: `Monthly Tuition - ${cls.name}`,
          classId: cls.id, feeType: 'TUITION',
          amount: monthlyAmount, frequency: 'MONTHLY',
          dueDate: new Date('2025-04-10'), academicYear: '2025-2026',
        },
      });
    }
    const existingAnnual = await prisma.feeStructure.findFirst({
      where: { classId: cls.id, feeType: 'ANNUAL', academicYear: '2025-2026' },
    });
    if (!existingAnnual) {
      await prisma.feeStructure.create({
        data: {
          name: `Annual Charge - ${cls.name}`,
          classId: cls.id, feeType: 'ANNUAL',
          amount: 1200, frequency: 'ANNUAL',
          dueDate: new Date('2025-04-01'), academicYear: '2025-2026',
        },
      });
    }
  }

  // ─── FEE LEDGER (realistic like physical register) ────────
  console.log('\nSeeding fee ledger (realistic entries)...');
  const academicMonths = [
    '2025-04', '2025-05', '2025-06', '2025-07', '2025-08',
    '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03',
  ];

  for (const student of allStudents) {
    const monthlyFee = 500 + student.class.numericGrade * 50;
    let balance = 0;
    const hasPrevBalance = Math.random() < 0.2; // 20% have previous balance

    // Previous balance for some students
    if (hasPrevBalance) {
      const prevAmount = Math.floor(1000 + Math.random() * 5000);
      balance += prevAmount;
      await prisma.feeLedger.create({
        data: {
          studentId: student.id,
          date: new Date('2025-04-01'),
          month: '2025-04',
          type: 'CHARGE',
          category: 'PREVIOUS_BALANCE',
          description: `Previous balance (2024-2025)`,
          amount: prevAmount,
          balanceAfter: balance,
        },
      });
    }

    // April: admission charges (annual + book)
    const annualCharge = 1200;
    const bookCharge = 1500 + Math.floor(Math.random() * 2000);
    balance += annualCharge;
    await prisma.feeLedger.create({
      data: {
        studentId: student.id,
        date: new Date('2025-04-01'),
        month: '2025-04',
        type: 'CHARGE',
        category: 'ANNUAL',
        description: 'Annual Charge',
        amount: annualCharge,
        balanceAfter: balance,
      },
    });
    balance += bookCharge;
    await prisma.feeLedger.create({
      data: {
        studentId: student.id,
        date: new Date('2025-04-01'),
        month: '2025-04',
        type: 'CHARGE',
        category: 'BOOK',
        description: 'Book Charge',
        amount: bookCharge,
        balanceAfter: balance,
      },
    });

    // Monthly fees + occasional deposits (realistic pattern)
    // Some students pay regularly, some are irregular, some are behind
    const paymentStyle = Math.random(); // 0-0.4 regular, 0.4-0.7 irregular, 0.7-1.0 behind
    const paymentMethods = ['CASH', 'UPI', 'CASH', 'CASH', 'UPI', 'CHEQUE'];
    const receivers = ['Goyal', 'Dubey', 'Dinesh', 'Basu'];

    for (let mi = 0; mi < academicMonths.length; mi++) {
      const month = academicMonths[mi];
      const monthDate = new Date(month + '-01');

      // Skip future months
      if (monthDate > new Date()) break;

      // Monthly fee charge (skip June for holiday schools — still charge though)
      balance += monthlyFee;
      await prisma.feeLedger.create({
        data: {
          studentId: student.id,
          date: monthDate,
          month,
          type: 'CHARGE',
          category: 'MONTHLY_FEE',
          description: 'Monthly Fee',
          amount: monthlyFee,
          balanceAfter: balance,
        },
      });

      // Occasional other charges (dress in July, copy in Sep, etc.)
      if (month === '2025-07' && Math.random() < 0.5) {
        const dressAmt = 350 + Math.floor(Math.random() * 300);
        balance += dressAmt;
        await prisma.feeLedger.create({
          data: {
            studentId: student.id,
            date: new Date('2025-07-15'),
            month,
            type: 'CHARGE',
            category: 'DRESS',
            description: 'Dress-I',
            amount: dressAmt,
            balanceAfter: balance,
          },
        });
      }
      if (month === '2025-09' && Math.random() < 0.4) {
        const tieAmt = 150 + Math.floor(Math.random() * 200);
        balance += tieAmt;
        await prisma.feeLedger.create({
          data: {
            studentId: student.id,
            date: new Date('2025-09-10'),
            month,
            type: 'CHARGE',
            category: 'TIE_BELT',
            description: 'Pant + Tie',
            amount: tieAmt,
            balanceAfter: balance,
          },
        });
      }

      // Deposits — based on payment style
      let shouldPay = false;
      if (paymentStyle < 0.4) {
        // Regular — pays most months
        shouldPay = Math.random() < 0.8;
      } else if (paymentStyle < 0.7) {
        // Irregular — pays every 2-3 months
        shouldPay = mi % 2 === 0 || mi % 3 === 0;
      } else {
        // Behind — pays rarely with big lump sums
        shouldPay = mi === 0 || mi === 4 || mi === 7 || mi === 10;
      }

      if (shouldPay && balance > 0) {
        // Pay a realistic amount (sometimes partial, sometimes catch-up)
        let payAmount: number;
        if (paymentStyle < 0.4) {
          payAmount = Math.min(monthlyFee + Math.floor(Math.random() * 500), balance);
        } else if (paymentStyle < 0.7) {
          payAmount = Math.min(monthlyFee * 2 + Math.floor(Math.random() * 1000), balance);
        } else {
          payAmount = Math.min(3000 + Math.floor(Math.random() * 5000), balance);
        }

        payAmount = Math.round(payAmount / 100) * 100; // round to nearest 100
        if (payAmount > 0 && payAmount <= balance) {
          balance -= payAmount;
          const depositDay = 5 + Math.floor(Math.random() * 20);
          const depositDate = new Date(monthDate);
          depositDate.setDate(Math.min(depositDay, 28));

          await prisma.feeLedger.create({
            data: {
              studentId: student.id,
              date: depositDate,
              month,
              type: 'DEPOSIT',
              category: 'DEPOSIT',
              description: `Deposit via ${pick(paymentMethods)}`,
              amount: payAmount,
              balanceAfter: balance,
              paymentMethod: pick(paymentMethods),
              receiptNumber: `RCP-${student.admissionNo}-${month}`,
              receivedBy: pick(receivers),
            },
          });
        }
      }
    }
    if (allStudents.indexOf(student) % 10 === 0) {
      console.log(`  Ledger seeded: ${allStudents.indexOf(student) + 1}/${allStudents.length} students`);
    }
  }

  // ─── ATTENDANCE (every school day Apr 2025 - Mar 2026) ───
  console.log('\nSeeding attendance records...');
  const isSchoolDay = (d: Date) => {
    const day = d.getDay();
    return day !== 0; // Sunday off only (Indian schools have Saturday classes)
  };

  // Generate all school days from Apr 1 2025 to today (or Mar 31 2026)
  const attendanceStart = new Date('2025-04-01');
  const attendanceEnd = new Date(Math.min(new Date().getTime(), new Date('2026-03-31').getTime()));
  const schoolDays: Date[] = [];
  for (let d = new Date(attendanceStart); d <= attendanceEnd; d.setDate(d.getDate() + 1)) {
    if (isSchoolDay(d)) {
      // Skip June 1-15 (summer break) and Oct 20-31 (Diwali break)
      const m = d.getMonth() + 1;
      const day = d.getDate();
      if (m === 6 && day <= 15) continue;
      if (m === 10 && day >= 20) continue;
      schoolDays.push(new Date(d));
    }
  }

  console.log(`  ${schoolDays.length} school days to seed...`);

  // Batch create attendance — each student gets an entry for each school day
  for (let si = 0; si < allStudents.length; si++) {
    const student = allStudents[si];
    // Attendance pattern: 85-98% present
    const presentRate = 0.85 + Math.random() * 0.13;

    const records = schoolDays.map(date => {
      const r = Math.random();
      let status: AttendanceStatus;
      if (r < presentRate) status = 'PRESENT';
      else if (r < presentRate + 0.03) status = 'LATE';
      else status = 'ABSENT';

      return {
        studentId: student.id,
        date,
        status,
      };
    });

    // Batch in chunks of 100 to avoid query limits
    for (let i = 0; i < records.length; i += 100) {
      const chunk = records.slice(i, i + 100);
      await prisma.attendance.createMany({
        data: chunk,
        skipDuplicates: true,
      });
    }

    if ((si + 1) % 10 === 0) {
      console.log(`  Attendance seeded: ${si + 1}/${allStudents.length} students`);
    }
  }

  // ─── EXAMS + GRADES (Sunday tests per month) ─────────────
  console.log('\nSeeding exams and grades...');
  const subjects = await prisma.subject.findMany();
  const examMonths = academicMonths.filter(m => {
    const d = new Date(m + '-01');
    return d <= new Date();
  });

  for (const cls of classes) {
    const classSubjects = subjects.filter(s => s.classId === cls.id);
    if (classSubjects.length === 0) continue;

    for (const month of examMonths) {
      // Create a Sunday test for this class this month
      const examDate = new Date(month + '-15'); // mid-month
      const exam = await prisma.exam.create({
        data: {
          name: `Sunday Test - ${new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long' })}`,
          type: 'UNIT_TEST' as ExamType,
          classId: cls.id,
          startDate: examDate,
          endDate: examDate,
        },
      });

      // Create exam subjects (pick up to 3 subjects)
      const testSubjects = classSubjects.slice(0, Math.min(3, classSubjects.length));
      for (const sub of testSubjects) {
        const examSubject = await prisma.examSubject.create({
          data: {
            examId: exam.id,
            subjectId: sub.id,
            date: examDate,
            maxMarks: 100,
            passingMarks: 33,
          },
        });

        // Grade every student in this class
        const classStudents = allStudents.filter(s => s.classId === cls.id);
        const gradeData = classStudents.map(s => ({
          studentId: s.id,
          examSubjectId: examSubject.id,
          marksObtained: Math.floor(40 + Math.random() * 55), // 40-95 range
          grade: '',
        }));
        // Calculate grade
        for (const g of gradeData) {
          const pct = g.marksObtained;
          g.grade = pct >= 91 ? 'A+' : pct >= 81 ? 'A' : pct >= 71 ? 'B+' : pct >= 61 ? 'B' : pct >= 51 ? 'C+' : pct >= 41 ? 'C' : pct >= 33 ? 'D' : 'E';
        }
        await prisma.grade.createMany({ data: gradeData, skipDuplicates: true });
      }
    }
    console.log(`  Exams + grades seeded for ${cls.name}`);
  }

  // ─── MONTHLY REPORTS (discipline) ─────────────────────────
  console.log('\nSeeding monthly reports (discipline + comments)...');
  const disciplines = ['V_GOOD', 'V_GOOD', 'V_GOOD', 'GOOD', 'GOOD', 'AVERAGE'];
  const comments = [
    '', '', '', // mostly empty
    'Keep up the good work',
    'Needs improvement in homework',
    'Excellent participation',
    'Should focus more in class',
    'Very helpful to classmates',
  ];

  for (const student of allStudents) {
    for (const month of examMonths) {
      if (Math.random() < 0.7) { // 70% of months have discipline entries
        await prisma.monthlyReport.create({
          data: {
            studentId: student.id,
            month,
            academicYear: '2025-2026',
            discipline: pick(disciplines),
            comment: pick(comments) || null,
          },
        });
      }
    }
  }

  console.log('  Monthly reports seeded for all students');
  console.log('\nSeeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
