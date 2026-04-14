import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function randomAmount(min: number, max: number) {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

async function main() {
  console.log('Seeding finance data...');

  // --- Expenses ---
  const expenseData = [
    { category: 'INFRASTRUCTURE', title: 'Classroom furniture — 20 desks', amount: 85000, date: '2025-07-15', paidTo: 'Godrej Interiors', paymentMode: 'BANK_TRANSFER' },
    { category: 'INFRASTRUCTURE', title: 'Whiteboard installation — Block B', amount: 24000, date: '2025-08-02', paidTo: 'Krishna Enterprises', paymentMode: 'CHEQUE' },
    { category: 'UTILITIES', title: 'Electricity bill — July', amount: 42500, date: '2025-08-05', paidTo: 'MSEDCL', paymentMode: 'BANK_TRANSFER' },
    { category: 'UTILITIES', title: 'Electricity bill — August', amount: 38700, date: '2025-09-04', paidTo: 'MSEDCL', paymentMode: 'BANK_TRANSFER' },
    { category: 'UTILITIES', title: 'Water supply — Q3', amount: 15000, date: '2025-10-01', paidTo: 'Municipal Corp', paymentMode: 'CHEQUE' },
    { category: 'STATIONERY', title: 'Chalk, markers, registers bulk order', amount: 12800, date: '2025-07-20', paidTo: 'Navneet Supplies', paymentMode: 'CASH' },
    { category: 'STATIONERY', title: 'Exam answer sheets — midterm', amount: 8500, date: '2025-10-10', paidTo: 'City Press', paymentMode: 'UPI' },
    { category: 'TRANSPORT', title: 'School bus diesel — July', amount: 28000, date: '2025-07-30', paidTo: 'Indian Oil', paymentMode: 'CASH' },
    { category: 'TRANSPORT', title: 'School bus diesel — August', amount: 26500, date: '2025-08-30', paidTo: 'Indian Oil', paymentMode: 'CASH' },
    { category: 'TRANSPORT', title: 'Bus servicing & repair', amount: 35000, date: '2025-09-15', paidTo: 'AutoFix Garage', paymentMode: 'UPI' },
    { category: 'MAINTENANCE', title: 'Plumbing repair — washrooms', amount: 9500, date: '2025-08-12', paidTo: 'Ram Plumbing Works', paymentMode: 'CASH' },
    { category: 'MAINTENANCE', title: 'Painting — corridors Block A', amount: 45000, date: '2025-06-20', paidTo: 'ColorMax Painters', paymentMode: 'CHEQUE' },
    { category: 'EVENTS', title: 'Independence Day celebration', amount: 18000, date: '2025-08-15', paidTo: 'Event coordinator', paymentMode: 'CASH' },
    { category: 'EVENTS', title: 'Annual Sports Day setup', amount: 55000, date: '2025-12-10', paidTo: 'Sports World Events', paymentMode: 'BANK_TRANSFER' },
    { category: 'SPORTS', title: 'Cricket & football equipment', amount: 22000, date: '2025-07-05', paidTo: 'Decathlon', paymentMode: 'UPI' },
    { category: 'TECHNOLOGY', title: 'Projectors — 5 classrooms', amount: 125000, date: '2025-07-10', paidTo: 'Epson India', paymentMode: 'BANK_TRANSFER' },
    { category: 'TECHNOLOGY', title: 'Wi-Fi upgrade & routers', amount: 32000, date: '2025-08-25', paidTo: 'NetGear Solutions', paymentMode: 'UPI' },
    { category: 'TECHNOLOGY', title: 'Computer lab — 10 desktops', amount: 350000, date: '2025-09-01', paidTo: 'Dell India', paymentMode: 'BANK_TRANSFER' },
    { category: 'INSURANCE', title: 'School building insurance — annual', amount: 95000, date: '2025-07-01', paidTo: 'LIC General', paymentMode: 'CHEQUE' },
    { category: 'MARKETING', title: 'Admission campaign — social media ads', amount: 15000, date: '2025-11-01', paidTo: 'DigitalAds Co', paymentMode: 'UPI' },
    { category: 'MISCELLANEOUS', title: 'Guest speaker honorarium', amount: 5000, date: '2025-09-20', paidTo: 'Dr. Priya Mathur', paymentMode: 'CASH' },
    { category: 'MISCELLANEOUS', title: 'Staff refreshment — quarterly', amount: 8000, date: '2025-10-15', paidTo: 'Canteen vendor', paymentMode: 'CASH' },
    { category: 'UTILITIES', title: 'Internet bill — 6 months', amount: 54000, date: '2025-07-01', paidTo: 'Airtel Business', paymentMode: 'BANK_TRANSFER' },
    { category: 'INFRASTRUCTURE', title: 'Library bookshelf — 4 units', amount: 28000, date: '2025-08-20', paidTo: 'WoodCraft Furniture', paymentMode: 'CHEQUE' },
    { category: 'STATIONERY', title: 'Science lab consumables', amount: 18500, date: '2025-11-05', paidTo: 'Lab Supply House', paymentMode: 'UPI' },
  ];

  for (const exp of expenseData) {
    await prisma.expense.create({
      data: {
        category: exp.category as any,
        title: exp.title,
        amount: exp.amount,
        date: new Date(exp.date),
        paidTo: exp.paidTo,
        paymentMode: exp.paymentMode,
        academicYear: '2025-2026',
      },
    });
  }
  console.log(`  Created ${expenseData.length} expenses`);

  // --- Salaries ---
  const teacher = await prisma.teacher.findFirst({
    include: { user: { select: { firstName: true, lastName: true } } },
  });

  if (teacher) {
    const months = ['2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03'];
    const basicPay = 45000;
    const hra = 9000;
    const da = 4500;
    const ta = 2000;
    const deductions = 5400;
    const netPay = basicPay + hra + da + ta - deductions;

    for (const month of months) {
      const isPaid = month < '2026-03'; // March still pending
      await prisma.salary.upsert({
        where: { teacherId_month: { teacherId: teacher.id, month } },
        update: {},
        create: {
          teacherId: teacher.id,
          month,
          basicPay, hra, da, ta, deductions, netPay,
          status: isPaid ? 'PAID' : 'PENDING',
          paidDate: isPaid ? new Date(`${month}-28`) : null,
          paymentMode: isPaid ? 'BANK_TRANSFER' : null,
        },
      });
    }
    console.log(`  Created ${months.length} salary records for ${teacher.user.firstName} ${teacher.user.lastName}`);
  }

  // --- Fee structures + some payments (so income shows up) ---
  const classes = await prisma.class.findMany({ take: 3, orderBy: { numericGrade: 'asc' } });

  for (const cls of classes) {
    await prisma.feeStructure.upsert({
      where: { id: `fee-tuition-${cls.id}`.slice(0, 36).padEnd(36, '0') },
      update: {},
      create: {
        id: `fee-tuition-${cls.id}`.slice(0, 36).padEnd(36, '0'),
        name: `Tuition Fee — ${cls.name}`,
        classId: cls.id,
        feeType: 'TUITION',
        amount: 5000,
        frequency: 'MONTHLY',
        dueDate: new Date('2025-07-10'),
        academicYear: '2025-2026',
      },
    });
    await prisma.feeStructure.upsert({
      where: { id: `fee-annual-${cls.id}`.slice(0, 36).padEnd(36, '0') },
      update: {},
      create: {
        id: `fee-annual-${cls.id}`.slice(0, 36).padEnd(36, '0'),
        name: `Annual Fee — ${cls.name}`,
        classId: cls.id,
        feeType: 'ANNUAL',
        amount: 15000,
        frequency: 'ANNUAL',
        dueDate: new Date('2025-07-01'),
        academicYear: '2025-2026',
      },
    });
  }

  // Record payments from some students
  const students = await prisma.student.findMany({ take: 20 });
  const feeStructures = await prisma.feeStructure.findMany();
  let paymentCount = 0;

  for (const student of students) {
    const studentFees = feeStructures.filter(f => f.classId === student.classId);
    for (const fee of studentFees) {
      // 70% chance of having paid
      if (Math.random() < 0.7) {
        const existing = await prisma.payment.findFirst({
          where: { studentId: student.id, feeStructureId: fee.id },
        });
        if (!existing) {
          await prisma.payment.create({
            data: {
              studentId: student.id,
              feeStructureId: fee.id,
              amountPaid: fee.amount,
              status: 'PAID',
              paymentMethod: ['UPI', 'CASH', 'CARD', 'NET_BANKING'][Math.floor(Math.random() * 4)],
              receiptNumber: `RCP-${Date.now()}-${paymentCount}`,
              paidDate: new Date(2025, 6 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 28)),
            },
          });
          paymentCount++;
        }
      }
    }
  }
  console.log(`  Created ${paymentCount} student fee payments`);
  console.log(`  Created ${classes.length * 2} fee structures`);

  console.log('\nFinance seed complete!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
