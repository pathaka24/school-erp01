import { NextRequest } from 'next/server';
import { getSupabaseAdmin, TEMPLATE_ASSETS_BUCKET } from '@/lib/supabase';
import { requireScope } from '@/lib/apiAuth';

// One-time bucket setup. Public + 2 MB cap. Idempotent.
async function ensureBucket() {
  const supabase = getSupabaseAdmin();
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) throw listErr;
  if (!buckets?.some(b => b.name === TEMPLATE_ASSETS_BUCKET)) {
    const { error } = await supabase.storage.createBucket(TEMPLATE_ASSETS_BUCKET, {
      public: true,
      fileSizeLimit: 2 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    });
    if (error && !error.message.includes('already exists')) throw error;
  }
}

// POST /api/upload/logo
// FormData: file (image/jpeg|png|webp|svg+xml) — uploads to template-assets bucket
// Returns: { url }
// ADMIN only — used by the templates editor.
export async function POST(request: NextRequest) {
  const auth = await requireScope(request, 'settings');
  if (auth instanceof Response) return auth;

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
  if (!allowed.includes(file.type)) {
    return Response.json({ error: 'Only PNG / JPG / WEBP / SVG allowed' }, { status: 400 });
  }
  if (file.size > 2 * 1024 * 1024) {
    return Response.json({ error: 'File too large. Max 2 MB.' }, { status: 400 });
  }

  try {
    await ensureBucket();
    const supabase = getSupabaseAdmin();

    const ext = file.type === 'image/svg+xml' ? 'svg'
      : file.type.split('/')[1].replace('jpeg', 'jpg');
    const path = `logos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadErr } = await supabase.storage
      .from(TEMPLATE_ASSETS_BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploadErr) throw uploadErr;

    const { data } = supabase.storage.from(TEMPLATE_ASSETS_BUCKET).getPublicUrl(path);
    return Response.json({ url: data.publicUrl, sizeBytes: file.size });
  } catch (err: any) {
    return Response.json(
      { error: 'Upload failed: ' + (err.message || String(err)) },
      { status: 500 },
    );
  }
}
