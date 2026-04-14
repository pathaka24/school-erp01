import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

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

// GET /api/seed — run from browser
export async function GET() {
  const logs: string[] = [];
  const log = (msg: string) => { logs.push(msg); console.log(msg); };

  try {
    log('Seeding database...');

    const firstNamesMale = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Reyansh', 'Sai', 'Arnav', 'Dhruv', 'Kabir', 'Ritvik', 'Anirudh', 'Ishaan', 'Shaurya', 'Atharv', 'Advait', 'Pranav', 'Rohan', 'Karthik', 'Manav', 'Nikhil', 'Yash', 'Dev', 'Harsh', 'Rahul'];
    const firstNamesFemale = ['Ananya', 'Diya', 'Myra', 'Sara', 'Aadhya', 'Isha', 'Kavya', 'Anika', 'Prisha', 'Riya', 'Saanvi', 'Aanya', 'Nisha', 'Pooja', 'Meera', 'Tanya', 'Sneha', 'Neha', 'Shruti', 'Lavanya', 'Kriti', 'Simran', 'Jiya', 'Avni', 'Tanvi'];
    const lastNames = ['Sharma', 'Patel', 'Reddy', 'Kumar', 'Singh', 'Gupta', 'Verma', 'Joshi', 'Nair', 'Iyer', 'Rao', 'Mishra', 'Chauhan', 'Mehta', 'Das', 'Malhotra', 'Kulkarni', 'Pillai', 'Menon', 'Deshmukh', 'Bhat', 'Saxena', 'Kapoor', 'Tiwari', 'Pandey'];
    const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
    const categories = ['GENERAL', 'OBC', 'SC', 'ST'] as const;
    const religions = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Jain', 'Buddhist'];
    const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Jaipur'];
    const states = ['Maharashtra', 'Delhi', 'Karnataka', 'Telangana', 'Tamil Nadu', 'Maharashtra', 'West Bengal', 'Rajasthan'];
    const houses = ['Red', 'Blue', 'Green', 'Yellow'];
    const occupations = ['Engineer', 'Doctor', 'Teacher', 'Business', 'Lawyer', 'Accountant', 'Government Service', 'Farmer'];
    const streams = ['SCIENCE', 'COMMERCE', 'ARTS'] as const;

    // ─── Classes ───
    log('Creating classes...');
    for (let grade = 1; grade <= 10; grade++) {
      await prisma.class.upsert({
        where: { name: `Class ${grade}` },
        update: {},
        create: { name: `Class ${grade}`, numericGrade: grade },
      });
    }
    const classes = await prisma.class.findMany({ orderBy: { numericGrade: 'asc' } });

    // Sections
    for (const cls of classes) {
      for (const sectionName of ['A', 'B']) {
        const existing = await prisma.section.findUnique({
          where: { classId_name: { classId: cls.id, name: sectionName } },
        });
        if (!existing) {
          await prisma.section.create({ data: { name: sectionName, classId: cls.id } });
        }
      }
    }
    const sections = await prisma.section.findMany({ include: { class: true } });

    // ─── 50 Students (skip if already exist) ───
    const existingStudentCount = await prisma.student.count();
    if (existingStudentCount >= 50) {
      log(`Students already exist (${existingStudentCount}) — skipping`);
    } else {
      log('Creating 50 students...');
      for (let i = 1; i <= 50; i++) {
        const admissionNo = `ADM-2025-${String(i).padStart(3, '0')}`;
        const exists = await prisma.student.findUnique({ where: { admissionNo } });
        if (exists) continue;

        const isFemale = i % 2 === 0;
        const firstName = isFemale ? pick(firstNamesFemale) : pick(firstNamesMale);
        const lastName = pick(lastNames);
        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@school.edu`;
        const classIndex = Math.floor((i - 1) / 5) % classes.length;
        const cls = classes[classIndex];
        const classSections = sections.filter(s => s.classId === cls.id);
        const section = classSections[i % classSections.length];
        const cityIndex = Math.floor(Math.random() * cities.length);

        // Make sure email is unique
        const emailExists = await prisma.user.findUnique({ where: { email } });
        const finalEmail = emailExists ? `student${i}.${Date.now()}@school.edu` : email;

        await prisma.user.create({
          data: {
            email: finalEmail, passwordHash: '$2b$10$placeholder_hash_for_seed_data_only',
            role: 'STUDENT', firstName, lastName, phone: randomPhone(),
            student: {
              create: {
                admissionNo, dateOfBirth: randomDate(2010, 2017),
                gender: isFemale ? 'FEMALE' : 'MALE', bloodGroup: pick(bloodGroups),
                classId: cls.id, sectionId: section.id,
                nationality: 'Indian', religion: pick(religions), category: pick([...categories]),
                currentAddress: `${Math.floor(1 + Math.random() * 500)}, ${pick(['MG Road', 'Station Road', 'Gandhi Nagar', 'Nehru Colony'])}`,
                currentCity: cities[cityIndex], currentState: states[cityIndex], currentPincode: randomPincode(),
                fatherName: `${pick(firstNamesMale)} ${lastName}`, fatherOccupation: pick(occupations), fatherPhone: randomPhone(),
                motherName: `${pick(firstNamesFemale)} ${lastName}`, motherOccupation: pick(occupations), motherPhone: randomPhone(),
                admissionDate: randomDate(2023, 2025), admittedGrade: `Class ${cls.numericGrade}`,
                house: pick(houses),
                stream: cls.numericGrade >= 9 ? pick([...streams]) : 'NONE',
                rollNumber: String(i), annualIncome: Math.floor(200000 + Math.random() * 1800000),
              },
            },
          },
        });
      }
    }

    // ─── Admin + Teacher ───
    log('Creating admin and teacher...');
    const adminExists = await prisma.user.findUnique({ where: { email: 'admin@school.com' } });
    if (!adminExists) {
      const adminHash = await bcrypt.hash('password123', 12);
      await prisma.user.create({
        data: { email: 'admin@school.com', passwordHash: adminHash, role: 'ADMIN', firstName: 'Admin', lastName: 'User', phone: '9000000000' },
      });
    }

    let teacherUser = await prisma.user.findUnique({ where: { email: 'rahul.sharma@school.com' } });
    if (!teacherUser) {
      const teacherHash = await bcrypt.hash('teacher123', 12);
      teacherUser = await prisma.user.create({
        data: { email: 'rahul.sharma@school.com', passwordHash: teacherHash, role: 'TEACHER', firstName: 'Rahul', lastName: 'Sharma', phone: '9876543210' },
      });
    }

    const sectionA = sections.find(s => s.classId === classes[0].id && s.name === 'A')!;
    let teacherRecord = await prisma.teacher.findUnique({ where: { userId: teacherUser.id } });
    if (!teacherRecord) {
      teacherRecord = await prisma.teacher.create({
        data: { userId: teacherUser.id, employeeId: 'EMP-001', qualification: 'M.Ed', experience: 8 },
      });
    }
    await prisma.section.update({ where: { id: sectionA.id }, data: { classTeacherId: teacherRecord.id } });

    // ─── Subjects for ALL classes ───
    log('Creating subjects...');
    const subjectNames = ['Mathematics', 'English', 'Science', 'Hindi', 'Social Studies'];
    for (const cls of classes) {
      for (const subName of subjectNames) {
        const code = `${subName.slice(0, 3).toUpperCase()}-${cls.numericGrade}`;
        await prisma.subject.upsert({
          where: { code }, update: {},
          create: { name: subName, code, classId: cls.id, teacherId: teacherRecord.id },
        });
      }
    }

    // ─── Families (siblings) ───
    log('Creating families...');
    const allStudents = await prisma.student.findMany({
      include: { user: true, class: true }, orderBy: { admissionNo: 'asc' },
    });

    const existingFamilies = await prisma.family.count();
    if (existingFamilies > 0) {
      log(`  Families already exist (${existingFamilies}) — skipping`);
    } else {
      const usedStudents = new Set<string>();
      let familyCount = 0;
      for (let i = 0; i < allStudents.length - 1 && familyCount < 8; i++) {
        if (usedStudents.has(allStudents[i].id)) continue;
        for (let j = i + 1; j < allStudents.length; j++) {
          if (usedStudents.has(allStudents[j].id)) continue;
          if (allStudents[i].user.lastName === allStudents[j].user.lastName) {
            const family = await prisma.family.create({
              data: { familyId: `FAM-2025-${String(familyCount + 1).padStart(3, '0')}`, name: `${allStudents[i].user.lastName} Family` },
            });
            await prisma.student.update({ where: { id: allStudents[i].id }, data: { familyId: family.id } });
            await prisma.student.update({ where: { id: allStudents[j].id }, data: { familyId: family.id } });
            usedStudents.add(allStudents[i].id);
            usedStudents.add(allStudents[j].id);
            familyCount++;
            log(`  Family: ${allStudents[i].user.firstName} + ${allStudents[j].user.firstName} ${allStudents[i].user.lastName}`);
            break;
          }
        }
      }
    }

    // ─── Fee Structures ───
    log('Creating fee structures...');
    for (const cls of classes) {
      const monthlyAmount = 500 + cls.numericGrade * 50;
      const existM = await prisma.feeStructure.findFirst({ where: { classId: cls.id, feeType: 'TUITION', academicYear: '2025-2026' } });
      if (!existM) {
        await prisma.feeStructure.create({
          data: { name: `Monthly Tuition - ${cls.name}`, classId: cls.id, feeType: 'TUITION', amount: monthlyAmount, frequency: 'MONTHLY', dueDate: new Date('2025-04-10'), academicYear: '2025-2026' },
        });
      }
      const existA = await prisma.feeStructure.findFirst({ where: { classId: cls.id, feeType: 'ANNUAL', academicYear: '2025-2026' } });
      if (!existA) {
        await prisma.feeStructure.create({
          data: { name: `Annual Charge - ${cls.name}`, classId: cls.id, feeType: 'ANNUAL', amount: 1200, frequency: 'ANNUAL', dueDate: new Date('2025-04-01'), academicYear: '2025-2026' },
        });
      }
    }

    // ─── Fee Ledger ───
    log('Seeding fee ledger...');
    const academicMonths = ['2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03'];
    const paymentMethods = ['CASH', 'UPI', 'CASH', 'CASH', 'UPI', 'CHEQUE'];
    const receivers = ['Goyal', 'Dubey', 'Dinesh', 'Basu'];

    // Check if ledger already seeded for this student set
    const studentsWithLedger = await prisma.feeLedger.groupBy({ by: ['studentId'], _count: true });
    const studentsAlreadySeeded = new Set(studentsWithLedger.map(s => s.studentId));
    const studentsNeedingLedger = allStudents.filter(s => !studentsAlreadySeeded.has(s.id));

    if (studentsNeedingLedger.length === 0) {
      log('  Fee ledger already seeded for all students — skipping');
    } else {
      log(`  Seeding ledger for ${studentsNeedingLedger.length} students...`);
      for (let si = 0; si < studentsNeedingLedger.length; si++) {
        const student = studentsNeedingLedger[si];
        const monthlyFee = 500 + student.class.numericGrade * 50;
        let balance = 0;

        // Previous balance (20% of students)
        if (Math.random() < 0.2) {
          const prevAmt = Math.floor(1000 + Math.random() * 5000);
          balance += prevAmt;
          await prisma.feeLedger.create({
            data: { studentId: student.id, date: new Date('2025-04-01'), month: '2025-04', type: 'CHARGE', category: 'PREVIOUS_BALANCE', description: 'Previous balance (2024-2025)', amount: prevAmt, balanceAfter: balance },
          });
        }

        // April charges
        balance += 1200;
        await prisma.feeLedger.create({
          data: { studentId: student.id, date: new Date('2025-04-01'), month: '2025-04', type: 'CHARGE', category: 'ANNUAL', description: 'Annual Charge', amount: 1200, balanceAfter: balance },
        });
        const bookAmt = 1500 + Math.floor(Math.random() * 2000);
        balance += bookAmt;
        await prisma.feeLedger.create({
          data: { studentId: student.id, date: new Date('2025-04-01'), month: '2025-04', type: 'CHARGE', category: 'BOOK', description: 'Book Charge', amount: bookAmt, balanceAfter: balance },
        });

        const payStyle = Math.random();

        for (let mi = 0; mi < academicMonths.length; mi++) {
          const month = academicMonths[mi];
          const monthDate = new Date(month + '-01');
          if (monthDate > new Date()) break;

          // Monthly charge
          balance += monthlyFee;
          await prisma.feeLedger.create({
            data: { studentId: student.id, date: monthDate, month, type: 'CHARGE', category: 'MONTHLY_FEE', description: 'Monthly Fee', amount: monthlyFee, balanceAfter: balance },
          });

          // Dress in July
          if (month === '2025-07' && Math.random() < 0.5) {
            const amt = 350 + Math.floor(Math.random() * 300);
            balance += amt;
            await prisma.feeLedger.create({
              data: { studentId: student.id, date: new Date('2025-07-15'), month, type: 'CHARGE', category: 'DRESS', description: 'Dress-I', amount: amt, balanceAfter: balance },
            });
          }
          // Tie in Sep
          if (month === '2025-09' && Math.random() < 0.4) {
            const amt = 150 + Math.floor(Math.random() * 200);
            balance += amt;
            await prisma.feeLedger.create({
              data: { studentId: student.id, date: new Date('2025-09-10'), month, type: 'CHARGE', category: 'TIE_BELT', description: 'Pant + Tie', amount: amt, balanceAfter: balance },
            });
          }

          // Deposits
          let shouldPay = false;
          if (payStyle < 0.4) shouldPay = Math.random() < 0.8;
          else if (payStyle < 0.7) shouldPay = mi % 2 === 0 || mi % 3 === 0;
          else shouldPay = mi === 0 || mi === 4 || mi === 7 || mi === 10;

          if (shouldPay && balance > 0) {
            let payAmt: number;
            if (payStyle < 0.4) payAmt = Math.min(monthlyFee + Math.floor(Math.random() * 500), balance);
            else if (payStyle < 0.7) payAmt = Math.min(monthlyFee * 2 + Math.floor(Math.random() * 1000), balance);
            else payAmt = Math.min(3000 + Math.floor(Math.random() * 5000), balance);

            payAmt = Math.round(payAmt / 100) * 100;
            if (payAmt > 0 && payAmt <= balance) {
              balance -= payAmt;
              const depDate = new Date(monthDate);
              depDate.setDate(Math.min(5 + Math.floor(Math.random() * 20), 28));
              await prisma.feeLedger.create({
                data: {
                  studentId: student.id, date: depDate, month, type: 'DEPOSIT', category: 'DEPOSIT',
                  description: `Deposit via ${pick(paymentMethods)}`, amount: payAmt, balanceAfter: balance,
                  paymentMethod: pick(paymentMethods), receiptNumber: `RCP-${student.admissionNo}-${month}`,
                  receivedBy: pick(receivers),
                },
              });
            }
          }
        }
        if ((si + 1) % 10 === 0) log(`  Ledger: ${si + 1}/${studentsNeedingLedger.length}`);
      }
    }

    // ─── Attendance (always seeds — uses skipDuplicates) ───
    log('Seeding attendance...');
    const attStart = new Date('2025-04-01');
    const attEnd = new Date(Math.min(Date.now(), new Date('2026-03-31').getTime()));
    const schoolDays: Date[] = [];
    for (let d = new Date(attStart); d <= attEnd; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0) continue; // Sunday off
      const m = d.getMonth() + 1, day = d.getDate();
      if (m === 6 && day <= 15) continue; // Summer break
      if (m === 10 && day >= 20) continue; // Diwali break
      schoolDays.push(new Date(d));
    }
    log(`  ${schoolDays.length} school days to seed for ${allStudents.length} students...`);

    for (let si = 0; si < allStudents.length; si++) {
      const student = allStudents[si];
      const presentRate = 0.85 + Math.random() * 0.13;
      const records = schoolDays.map(date => {
        const r = Math.random();
        const status = r < presentRate ? 'PRESENT' : r < presentRate + 0.03 ? 'LATE' : 'ABSENT';
        return { studentId: student.id, date, status: status as any };
      });
      for (let i = 0; i < records.length; i += 100) {
        await prisma.attendance.createMany({ data: records.slice(i, i + 100), skipDuplicates: true });
      }
      if ((si + 1) % 10 === 0) log(`  Attendance: ${si + 1}/${allStudents.length}`);
    }
    log(`  Attendance done — ~${schoolDays.length * allStudents.length} records`);

    // ─── Exams + Grades ───
    log('Seeding exams and grades...');
    const existingExams = await prisma.exam.count();
    if (existingExams > 0) {
      log('  Exams already exist — skipping');
    } else {
      const subjects = await prisma.subject.findMany();
      const examMonths = academicMonths.filter(m => new Date(m + '-01') <= new Date());

      for (const cls of classes) {
        const classSubjects = subjects.filter(s => s.classId === cls.id);
        if (classSubjects.length === 0) continue;

        for (const month of examMonths) {
          const examDate = new Date(month + '-15');
          const exam = await prisma.exam.create({
            data: {
              name: `Sunday Test - ${new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long' })}`,
              type: 'UNIT_TEST', classId: cls.id, startDate: examDate, endDate: examDate,
            },
          });

          const testSubjects = classSubjects.slice(0, 3);
          for (const sub of testSubjects) {
            const examSubject = await prisma.examSubject.create({
              data: { examId: exam.id, subjectId: sub.id, date: examDate, maxMarks: 100, passingMarks: 33 },
            });
            const classStudents = allStudents.filter(s => s.classId === cls.id);
            const gradeData = classStudents.map(s => {
              const marks = Math.floor(40 + Math.random() * 55);
              return {
                studentId: s.id, examSubjectId: examSubject.id, marksObtained: marks,
                grade: marks >= 91 ? 'A+' : marks >= 81 ? 'A' : marks >= 71 ? 'B+' : marks >= 61 ? 'B' : marks >= 51 ? 'C+' : marks >= 41 ? 'C' : marks >= 33 ? 'D' : 'E',
              };
            });
            await prisma.grade.createMany({ data: gradeData, skipDuplicates: true });
          }
        }
        log(`  Exams: ${cls.name} done`);
      }
    }

    // ─── Monthly Reports (discipline) ───
    log('Seeding monthly reports...');
    const existingReports = await prisma.monthlyReport.count();
    if (existingReports > 0) {
      log('  Monthly reports already exist — skipping');
    } else {
      const disciplines = ['V_GOOD', 'V_GOOD', 'V_GOOD', 'GOOD', 'GOOD', 'AVERAGE'];
      const comments = ['', '', '', 'Keep up the good work', 'Needs improvement in homework', 'Excellent participation', 'Very helpful to classmates'];
      const reportMonths = academicMonths.filter(m => new Date(m + '-01') <= new Date());

      for (const student of allStudents) {
        const data = reportMonths
          .filter(() => Math.random() < 0.7)
          .map(month => ({
            studentId: student.id, month, academicYear: '2025-2026',
            discipline: pick(disciplines), comment: pick(comments) || null,
          }));
        if (data.length > 0) {
          await prisma.monthlyReport.createMany({ data, skipDuplicates: true });
        }
      }
      log('  Monthly reports done');
    }

    log('\nSeeding complete!');
    return Response.json({ success: true, logs }, { status: 200 });

  } catch (error: any) {
    log(`ERROR: ${error.message}`);
    return Response.json({ success: false, error: error.message, logs }, { status: 500 });
  }
}
