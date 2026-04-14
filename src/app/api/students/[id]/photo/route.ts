import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const student = await prisma.student.findUnique({ where: { id }, select: { id: true } });
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get('photo') as File | null;
  if (!file) return Response.json({ error: 'No photo file provided' }, { status: 400 });

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!allowedTypes.includes(file.type)) {
    return Response.json({ error: 'Only JPG, PNG, WEBP files allowed' }, { status: 400 });
  }

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    return Response.json({ error: 'File size must be under 5MB' }, { status: 400 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${id}.${ext}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'students');

  // Ensure directory exists
  await mkdir(uploadDir, { recursive: true });

  // Write file
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  await writeFile(path.join(uploadDir, fileName), buffer);

  // Save path to student record
  const photoUrl = `/uploads/students/${fileName}?t=${Date.now()}`;
  await prisma.student.update({
    where: { id },
    data: { photo: photoUrl },
  });

  return Response.json({ photo: photoUrl }, { status: 200 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await prisma.student.update({
    where: { id },
    data: { photo: null },
  });

  return Response.json({ message: 'Photo removed' });
}
