import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const search = searchParams.get('search');
  const category = searchParams.get('category');

  const where: any = {};
  if (category) where.category = category;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { author: { contains: search, mode: 'insensitive' } },
      { isbn: { contains: search, mode: 'insensitive' } },
    ];
  }

  const books = await prisma.book.findMany({
    where,
    include: {
      _count: { select: { issues: { where: { status: 'ISSUED' } } } },
    },
    orderBy: { title: 'asc' },
  });

  return Response.json(
    books.map((b: any) => ({
      ...b,
      availableCopies: b.totalCopies - b._count.issues,
    }))
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, author, isbn, category, publisher, edition, language, totalCopies, shelfNumber, description } = body;

  if (!title || !author) {
    return Response.json({ error: 'title and author are required' }, { status: 400 });
  }

  try {
    const book = await prisma.book.create({
      data: {
        title,
        author,
        isbn: isbn || null,
        category: category || null,
        publisher: publisher || null,
        edition: edition || null,
        language: language || null,
        totalCopies: Number(totalCopies) || 1,
        shelfNumber: shelfNumber || null,
        description: description || null,
      },
    });
    return Response.json(book, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') return Response.json({ error: 'A book with this ISBN already exists' }, { status: 409 });
    return Response.json({ error: 'Failed to create book' }, { status: 500 });
  }
}
