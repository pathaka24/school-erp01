import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = await prisma.book.findUnique({
    where: { id },
    include: {
      issues: {
        include: {
          student: { include: { user: { select: { firstName: true, lastName: true } } } },
          teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { issuedDate: 'desc' },
      },
    },
  });
  if (!book) return Response.json({ error: 'Book not found' }, { status: 404 });
  const issued = book.issues.filter(i => i.status === 'ISSUED').length;
  return Response.json({ ...book, availableCopies: book.totalCopies - issued });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const data: any = {};
  for (const k of ['title', 'author', 'isbn', 'category', 'publisher', 'edition', 'language', 'shelfNumber', 'description']) {
    if (body[k] !== undefined) data[k] = body[k] || null;
  }
  if (body.totalCopies !== undefined) data.totalCopies = Number(body.totalCopies);

  try {
    const book = await prisma.book.update({ where: { id }, data });
    return Response.json(book);
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Book not found' }, { status: 404 });
    if (error.code === 'P2002') return Response.json({ error: 'ISBN conflict' }, { status: 409 });
    return Response.json({ error: 'Failed to update book' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.book.delete({ where: { id } });
    return Response.json({ message: 'Book deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') return Response.json({ error: 'Book not found' }, { status: 404 });
    return Response.json({ error: 'Failed to delete book' }, { status: 500 });
  }
}
