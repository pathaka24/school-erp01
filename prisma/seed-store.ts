import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding store data...');

  const items = [
    // Books
    { name: 'NCERT Mathematics Class 1', category: 'BOOKS', price: 120, stock: 45, supplier: 'NCERT Publications' },
    { name: 'NCERT English Class 1', category: 'BOOKS', price: 110, stock: 40, supplier: 'NCERT Publications' },
    { name: 'NCERT Science Class 1', category: 'BOOKS', price: 130, stock: 38, supplier: 'NCERT Publications' },
    { name: 'NCERT Hindi Class 1', category: 'BOOKS', price: 100, stock: 42, supplier: 'NCERT Publications' },
    { name: 'NCERT Social Studies Class 1', category: 'BOOKS', price: 115, stock: 35, supplier: 'NCERT Publications' },
    { name: 'Drawing & Colouring Book', category: 'BOOKS', price: 80, stock: 60, supplier: 'Navneet' },
    { name: 'Handwriting Practice Book', category: 'BOOKS', price: 50, stock: 55, supplier: 'Navneet' },
    { name: 'General Knowledge Book', category: 'BOOKS', price: 90, stock: 30, supplier: 'S. Chand' },
    { name: 'Computer Basics Book', category: 'BOOKS', price: 150, stock: 25, supplier: 'Oxford Publications' },

    // Uniform
    { name: 'School Shirt (White) - S', category: 'UNIFORM', price: 350, stock: 30, unit: 'pcs', supplier: 'Bombay Textiles' },
    { name: 'School Shirt (White) - M', category: 'UNIFORM', price: 350, stock: 35, unit: 'pcs', supplier: 'Bombay Textiles' },
    { name: 'School Shirt (White) - L', category: 'UNIFORM', price: 380, stock: 25, unit: 'pcs', supplier: 'Bombay Textiles' },
    { name: 'School Trouser (Grey) - S', category: 'UNIFORM', price: 400, stock: 28, unit: 'pcs', supplier: 'Bombay Textiles' },
    { name: 'School Trouser (Grey) - M', category: 'UNIFORM', price: 400, stock: 32, unit: 'pcs', supplier: 'Bombay Textiles' },
    { name: 'School Trouser (Grey) - L', category: 'UNIFORM', price: 430, stock: 20, unit: 'pcs', supplier: 'Bombay Textiles' },
    { name: 'School Tie', category: 'UNIFORM', price: 150, stock: 50, unit: 'pcs', supplier: 'Bombay Textiles' },
    { name: 'School Belt', category: 'UNIFORM', price: 120, stock: 40, unit: 'pcs', supplier: 'Leather House' },
    { name: 'School Socks (Pair)', category: 'UNIFORM', price: 60, stock: 80, unit: 'pairs', supplier: 'Jockey India' },
    { name: 'School Shoes - Size 3', category: 'UNIFORM', price: 650, stock: 15, unit: 'pairs', supplier: 'Bata' },
    { name: 'School Shoes - Size 4', category: 'UNIFORM', price: 650, stock: 18, unit: 'pairs', supplier: 'Bata' },
    { name: 'School Shoes - Size 5', category: 'UNIFORM', price: 700, stock: 12, unit: 'pairs', supplier: 'Bata' },
    { name: 'Winter Sweater (Navy)', category: 'UNIFORM', price: 550, stock: 20, unit: 'pcs', supplier: 'Bombay Textiles' },
    { name: 'PT Uniform Set', category: 'UNIFORM', price: 450, stock: 25, unit: 'sets', supplier: 'Sports Wear Co' },
    { name: 'School Bag', category: 'UNIFORM', price: 800, stock: 30, unit: 'pcs', supplier: 'Wildcraft' },

    // Stationery
    { name: 'Notebook — 200 pages (single line)', category: 'STATIONERY', price: 40, stock: 200, supplier: 'Classmate' },
    { name: 'Notebook — 200 pages (four line)', category: 'STATIONERY', price: 40, stock: 150, supplier: 'Classmate' },
    { name: 'Notebook — 100 pages (graph)', category: 'STATIONERY', price: 35, stock: 80, supplier: 'Classmate' },
    { name: 'Pencil Box', category: 'STATIONERY', price: 120, stock: 60, supplier: 'Faber-Castell' },
    { name: 'HB Pencils (Pack of 10)', category: 'STATIONERY', price: 50, stock: 100, unit: 'packs', supplier: 'Apsara' },
    { name: 'Eraser (Pack of 5)', category: 'STATIONERY', price: 25, stock: 120, unit: 'packs', supplier: 'Apsara' },
    { name: 'Sharpener (Pack of 3)', category: 'STATIONERY', price: 20, stock: 100, unit: 'packs', supplier: 'Faber-Castell' },
    { name: 'Blue Pen (Pack of 5)', category: 'STATIONERY', price: 60, stock: 90, unit: 'packs', supplier: 'Reynolds' },
    { name: 'Geometry Box', category: 'STATIONERY', price: 180, stock: 40, supplier: 'Camlin' },
    { name: 'Ruler 30cm', category: 'STATIONERY', price: 15, stock: 100, supplier: 'Camlin' },
    { name: 'Glue Stick', category: 'STATIONERY', price: 30, stock: 70, supplier: 'Fevicol' },
    { name: 'Scissors (Student Safe)', category: 'STATIONERY', price: 45, stock: 50, supplier: 'Kangaro' },

    // Sports
    { name: 'Cricket Ball (Tennis)', category: 'SPORTS', price: 50, stock: 30, supplier: 'SG Sports' },
    { name: 'Skipping Rope', category: 'SPORTS', price: 80, stock: 25, supplier: 'Nivia' },
    { name: 'Badminton Shuttlecock (Pack of 6)', category: 'SPORTS', price: 120, stock: 20, unit: 'packs', supplier: 'Yonex' },
    { name: 'Football', category: 'SPORTS', price: 450, stock: 8, supplier: 'Nivia' },
    { name: 'Water Bottle 750ml', category: 'SPORTS', price: 200, stock: 40, supplier: 'Milton' },

    // Art supplies
    { name: 'Crayon Set — 24 colours', category: 'ART_SUPPLIES', price: 120, stock: 45, supplier: 'Camlin' },
    { name: 'Watercolor Set — 12 colours', category: 'ART_SUPPLIES', price: 80, stock: 35, supplier: 'Camlin' },
    { name: 'Drawing Sheet (A3 Pack of 20)', category: 'ART_SUPPLIES', price: 60, stock: 50, unit: 'packs', supplier: 'Navneet' },
    { name: 'Sketch Pens — 12 colours', category: 'ART_SUPPLIES', price: 60, stock: 40, supplier: 'Faber-Castell' },
    { name: 'Oil Pastels — 25 shades', category: 'ART_SUPPLIES', price: 150, stock: 30, supplier: 'Camlin' },
    { name: 'Clay Modelling Kit', category: 'ART_SUPPLIES', price: 100, stock: 20, supplier: 'Hobby Ideas' },

    // Low / out of stock items for alerts
    { name: 'School ID Card Holder', category: 'OTHER', price: 30, stock: 3, minStock: 10, supplier: 'PrintHouse' },
    { name: 'Lab Coat — S', category: 'LAB_EQUIPMENT', price: 300, stock: 0, supplier: 'Lab Essentials' },
    { name: 'USB Flash Drive 16GB', category: 'TECH_ACCESSORIES', price: 250, stock: 2, minStock: 5, supplier: 'SanDisk' },
  ];

  for (const item of items) {
    await prisma.storeItem.create({
      data: {
        name: item.name,
        category: item.category as any,
        price: item.price,
        stock: item.stock,
        minStock: (item as any).minStock || 5,
        unit: (item as any).unit || 'pcs',
        supplier: item.supplier,
      },
    });
  }
  console.log(`  Created ${items.length} store items`);

  // Create some sample orders
  const students = await prisma.student.findMany({ take: 8, include: { user: true } });
  const storeItems = await prisma.storeItem.findMany();

  const bookItems = storeItems.filter(i => i.category === 'BOOKS');
  const uniformItems = storeItems.filter(i => i.category === 'UNIFORM');
  const stationeryItems = storeItems.filter(i => i.category === 'STATIONERY');

  let orderCount = 0;
  for (const student of students) {
    // Each student bought some books + stationery
    const boughtBooks = bookItems.slice(0, 3 + Math.floor(Math.random() * 3));
    const boughtStationery = stationeryItems.slice(0, 2 + Math.floor(Math.random() * 3));
    const cartItems = [...boughtBooks, ...boughtStationery];

    const orderItems = cartItems.map(item => ({
      itemId: item.id,
      quantity: 1,
      unitPrice: item.price,
      total: item.price,
    }));

    const totalAmount = orderItems.reduce((s, i) => s + i.total, 0);

    await prisma.storeOrder.create({
      data: {
        orderNumber: `ORD-SEED-${++orderCount}`,
        studentId: student.id,
        buyerType: 'STUDENT',
        totalAmount,
        discount: 0,
        netAmount: totalAmount,
        paymentMethod: ['CASH', 'UPI', 'CARD'][Math.floor(Math.random() * 3)],
        status: 'COMPLETED',
        items: { create: orderItems },
      },
    });

    // Deduct stock
    for (const item of cartItems) {
      await prisma.storeItem.update({
        where: { id: item.id },
        data: { stock: { decrement: 1 } },
      });
    }
  }

  // One uniform order
  if (students.length > 0) {
    const uniItems = uniformItems.slice(0, 4);
    const uniOrderItems = uniItems.map(item => ({
      itemId: item.id,
      quantity: 1,
      unitPrice: item.price,
      total: item.price,
    }));
    const uniTotal = uniOrderItems.reduce((s, i) => s + i.total, 0);

    await prisma.storeOrder.create({
      data: {
        orderNumber: `ORD-SEED-${++orderCount}`,
        studentId: students[0].id,
        buyerType: 'STUDENT',
        totalAmount: uniTotal,
        discount: 50,
        netAmount: uniTotal - 50,
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        items: { create: uniOrderItems },
      },
    });
    for (const item of uniItems) {
      await prisma.storeItem.update({
        where: { id: item.id },
        data: { stock: { decrement: 1 } },
      });
    }
    orderCount++;
  }

  // Staff walk-in order
  await prisma.storeOrder.create({
    data: {
      orderNumber: `ORD-SEED-${++orderCount}`,
      buyerName: 'Mrs. Priya (Staff)',
      buyerType: 'STAFF',
      totalAmount: 240,
      discount: 0,
      netAmount: 240,
      paymentMethod: 'UPI',
      status: 'COMPLETED',
      items: {
        create: stationeryItems.slice(0, 3).map(item => ({
          itemId: item.id, quantity: 2, unitPrice: item.price, total: item.price * 2,
        })),
      },
    },
  });

  console.log(`  Created ${orderCount + 1} orders`);
  console.log('\nStore seed complete!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
