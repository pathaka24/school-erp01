// Generates PWA icons from scripts/icon-source.svg
// Run: node scripts/generate-pwa-icons.mjs
// Or:  npm run generate-icons

import sharp from 'sharp';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const sourcePath = path.join(__dirname, 'icon-source.svg');
const outDir = path.join(root, 'public');

const sizes = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 180, name: 'apple-touch-icon.png' }, // iOS home screen
  { size: 32,  name: 'favicon-32.png' },
  { size: 16,  name: 'favicon-16.png' },
];

async function main() {
  const svg = await readFile(sourcePath);
  console.log(`Generating ${sizes.length} icons from ${sourcePath}`);

  for (const { size, name } of sizes) {
    const out = path.join(outDir, name);
    await sharp(svg)
      .resize(size, size, { fit: 'contain', background: { r: 30, g: 58, b: 138, alpha: 1 } })
      .png()
      .toFile(out);
    console.log(`  ✓ ${name} (${size}×${size})`);
  }

  // Also write a favicon.ico-sized PNG (browsers accept .png as favicon now)
  const favicon = path.join(outDir, 'favicon.png');
  await sharp(svg).resize(48, 48).png().toFile(favicon);
  console.log(`  ✓ favicon.png (48×48)`);

  console.log('Done. Icons written to public/');
}

main().catch((e) => {
  console.error('Icon generation failed:', e);
  process.exit(1);
});
