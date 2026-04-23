export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
}

// Generate academic year list (5 years back to 2 years ahead)
export function getAcademicYears(): string[] {
  const now = new Date();
  const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; // Apr=new year
  const years: string[] = [];
  for (let y = currentYear - 5; y <= currentYear + 2; y++) {
    years.push(`${y}-${y + 1}`);
  }
  return years;
}

// Get current academic year
export function getCurrentAcademicYear(): string {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${year + 1}`;
}

// Client-side image compression. Resizes to maxDim, iteratively lowers JPEG quality
// until the file is under targetKB. Returns a new JPEG File. Saves bandwidth and
// keeps storage quota tiny on hosted Postgres / Supabase Storage.
export async function compressImage(
  file: File,
  { targetKB = 40, maxDim = 500 }: { targetKB?: number; maxDim?: number } = {}
): Promise<File> {
  if (typeof window === 'undefined') return file;
  if (!file.type.startsWith('image/')) return file;

  const bitmap = await createImageBitmap(file);
  let w = bitmap.width;
  let h = bitmap.height;
  if (w > maxDim || h > maxDim) {
    const scale = Math.min(maxDim / w, maxDim / h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);

  const toBlob = (q: number): Promise<Blob | null> =>
    new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/jpeg', q));

  let quality = 0.85;
  let blob = await toBlob(quality);
  for (let i = 0; i < 8 && blob && blob.size > targetKB * 1024; i++) {
    quality *= 0.75;
    if (quality < 0.35 && Math.max(w, h) > 240) {
      w = Math.round(w * 0.75);
      h = Math.round(h * 0.75);
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(bitmap, 0, 0, w, h);
      quality = 0.7;
    }
    blob = await toBlob(quality);
  }

  if (!blob) return file;
  const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
}
