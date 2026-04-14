import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  const patterns = await prisma.examPattern.findMany({ orderBy: { order: 'asc' } });
  return Response.json(patterns);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, displayName, maxMarks, passingPct, weightage, category, isActive, order } = body;

  if (!name || !displayName) {
    return Response.json({ error: 'Name and display name are required' }, { status: 400 });
  }

  try {
    const pattern = await prisma.examPattern.create({
      data: {
        name, displayName,
        maxMarks: parseInt(maxMarks) || 100,
        passingPct: parseFloat(passingPct) || 33,
        weightage: parseFloat(weightage) || 100,
        category: category || 'SUMMATIVE',
        isActive: isActive !== false,
        order: order || 0,
      },
    });
    return Response.json(pattern, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') return Response.json({ error: 'Pattern name already exists' }, { status: 409 });
    return Response.json({ error: 'Failed to create' }, { status: 500 });
  }
}
