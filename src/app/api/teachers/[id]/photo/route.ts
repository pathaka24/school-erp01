import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teacher = await prisma.teacher.findUnique({ where: { id }, select: { id: true } });
  if (!teacher) return Response.json({ error: 'Teacher not found' }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get('photo') as File | null;
  if (!file) return Response.json({ error: 'No photo' }, { status: 400 });

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) return Response.json({ error: 'Only JPG/PNG/WEBP' }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return Response.json({ error: 'Max 5MB' }, { status: 400 });

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${id}.${ext}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'teachers');
  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, fileName), buffer);

  const photoUrl = `/uploads/teachers/${fileName}?t=${Date.now()}`;
  await (prisma.teacher as any).update({ where: { id }, data: { photo: photoUrl } });

  return Response.json({ photo: photoUrl });
}
