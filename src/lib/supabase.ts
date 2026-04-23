import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client with service role key (bypasses RLS).
// Only use in API routes — never ship the service role key to the browser.
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  // Defer the error to call time rather than import time so the build doesn't fail
  // when these env vars aren't set yet.
}

export function getSupabaseAdmin() {
  if (!url) throw new Error('SUPABASE_URL is not set');
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const STUDENT_PHOTOS_BUCKET = 'student-photos';
