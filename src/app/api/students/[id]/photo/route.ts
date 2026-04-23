import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getSupabaseAdmin, STUDENT_PHOTOS_BUCKET } from '@/lib/supabase';

// Ensure the bucket exists (one-time setup, idempotent).
async function ensureBucket() {
  const supabase = getSupabaseAdmin();
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) throw listErr;
  if (!buckets?.some(b => b.name === STUDENT_PHOTOS_BUCKET)) {
    const { error: createErr } = await supabase.storage.createBucket(STUDENT_PHOTOS_BUCKET, {
      public: true,
      fileSizeLimit: 1024 * 1024, // 1 MB hard cap (compressed images are tiny)
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    if (createErr && !createErr.message.includes('already exists')) throw createErr;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const student = await prisma.student.findUnique({ where: { id }, select: { id: true, photo: true } });
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get('photo') as File | null;
  if (!file) return Response.json({ error: 'No photo file provided' }, { status: 400 });

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!allowedTypes.includes(file.type)) {
    return Response.json({ error: 'Only JPG, PNG, WEBP files allowed' }, { status: 400 });
  }

  // Max 1MB (client should compress to ~40KB; this is a safety cap)
  if (file.size > 1 * 1024 * 1024) {
    return Response.json({ error: 'File too large. Should be under 1 MB after compression.' }, { status: 400 });
  }

  try {
    await ensureBucket();
    const supabase = getSupabaseAdmin();

    const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    // Include timestamp so CDN caches are busted on replace
    const storagePath = `${id}/${Date.now()}.${ext}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadErr } = await supabase.storage
      .from(STUDENT_PHOTOS_BUCKET)
      .upload(storagePath, bytes, { contentType: file.type, upsert: true });
    if (uploadErr) throw uploadErr;

    const { data: publicUrlData } = supabase.storage
      .from(STUDENT_PHOTOS_BUCKET)
      .getPublicUrl(storagePath);

    // If the student previously had a photo, delete the old object to avoid quota leak
    if (student.photo) {
      const oldPath = extractStoragePath(student.photo);
      if (oldPath) {
        await supabase.storage.from(STUDENT_PHOTOS_BUCKET).remove([oldPath]);
      }
    }

    const photoUrl = publicUrlData.publicUrl;
    await prisma.student.update({ where: { id }, data: { photo: photoUrl } });

    return Response.json({ photo: photoUrl, sizeBytes: file.size }, { status: 200 });
  } catch (err: any) {
    return Response.json({ error: 'Upload failed: ' + (err.message || String(err)) }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const student = await prisma.student.findUnique({ where: { id }, select: { photo: true } });

  try {
    if (student?.photo) {
      const path = extractStoragePath(student.photo);
      if (path) {
        const supabase = getSupabaseAdmin();
        await supabase.storage.from(STUDENT_PHOTOS_BUCKET).remove([path]);
      }
    }
    await prisma.student.update({ where: { id }, data: { photo: null } });
    return Response.json({ message: 'Photo removed' });
  } catch (err: any) {
    return Response.json({ error: 'Delete failed: ' + (err.message || String(err)) }, { status: 500 });
  }
}

// Pull the storage key back out of a public Supabase URL, e.g.
// https://<proj>.supabase.co/storage/v1/object/public/student-photos/<id>/<ts>.jpg → <id>/<ts>.jpg
function extractStoragePath(photoUrl: string): string | null {
  const marker = `/object/public/${STUDENT_PHOTOS_BUCKET}/`;
  const i = photoUrl.indexOf(marker);
  if (i === -1) return null;
  return photoUrl.substring(i + marker.length).split('?')[0];
}
