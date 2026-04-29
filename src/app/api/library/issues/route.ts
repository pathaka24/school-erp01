import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/library/issues?status=&studentId=&teacherId=&bookId=&overdue=true
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status');
  const studentId = searchParams.get('studentId');
  const teacherId = searchParams.get('teacherId');
  const bookId = searchParams.get('bookId');
  const overdue = searchParams.get('overdue') === 'true';

  const where: any = {};
  if (status) where.status = status;
  if (studentId) where.studentId = studentId;
  if (teacherId) where.teacherId = teacherId;
  if (bookId) where.bookId = bookId;
  if (overdue) {
    where.status = 'ISSUED';
    where.dueDate = { lt: new Date() };
  }

  const issues = await prisma.bookIssue.findMany({
    where,
    include: {
      book: { select: { id: true, title: true, author: true, isbn: true } },
      student: { include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } }, section: { select: { name: true } } } },
      teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { issuedDate: 'desc' },
  });
  return Response.json(issues);
}

// POST /api/library/issues — issue a book
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { bookId, studentId, teacherId, dueDate, remarks } = body;

  if (!bookId) return Response.json({ error: 'bookId is required' }, { status: 400 });
  if (!studentId && !teacherId) return Response.json({ error: 'Either studentId or teacherId required' }, { status: 400 });
  if (!dueDate) return Response.json({ error: 'dueDate is required' }, { status: 400 });

  // Check availability
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: { _count: { select: { issues: { where: { status: 'ISSUED' } } } } },
  });
  if (!book) return Response.json({ error: 'Book not found' }, { status: 404 });
  if (book._count.issues >= book.totalCopies) {
    return Response.json({ error: 'No copies available' }, { status: 400 });
  }

  const issue = await prisma.bookIssue.create({
    data: {
      bookId,
      studentId: studentId || null,
      teacherId: teacherId || null,
      dueDate: new Date(dueDate),
      remarks: remarks || null,
    },
    include: {
      book: { select: { title: true } },
    },
  });
  return Response.json(issue, { status: 201 });
}
