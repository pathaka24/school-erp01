// Generates Expo mobile app icons from scripts/icon-source.svg
// Outputs to ../mobile2/assets/
// Run: node scripts/generate-mobile-icons.mjs

import sharp from 'sharp';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(__dirname, 'icon-source.svg');
const outDir = path.resolve(__dirname, '..', '..', 'mobile2', 'assets');

const BG = { r: 30, g: 58, b: 138, alpha: 1 }; // #1e3a8a (matches splash background in app.json)

const sizes = [
  { size: 1024, name: 'icon.png',           padding: 0 },        // App icon (iOS + Android base)
  { size: 1024, name: 'adaptive-icon.png',  padding: 200 },      // Android adaptive (foreground inset)
  { size: 1024, name: 'splash-icon.png',    padding: 280 },      // Splash centerpiece
  { size: 48,   name: 'favicon.png',        padding: 0 },        // Web favicon
];

async function main() {
  const svg = await readFile(sourcePath);
  console.log(`Generating ${sizes.length} mobile icons → ${outDir}`);

  for (const { size, name, padding } of sizes) {
    const inner = size - 2 * padding;
    const out = path.join(outDir, name);
    if (padding > 0) {
      // Render the SVG to inner size, then composite onto a colored canvas
      const innerPng = await sharp(svg).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
      await sharp({
        create: { width: size, height: size, channels: 4, background: BG },
      })
        .composite([{ input: innerPng, top: padding, left: padding }])
        .png()
        .toFile(out);
    } else {
      await sharp(svg)
        .resize(size, size, { fit: 'contain', background: BG })
        .png()
        .toFile(out);
    }
    console.log(`  ✓ ${name} (${size}×${size}${padding ? `, padding ${padding}` : ''})`);
  }

  console.log('Done.');
}

main().catch((e) => {
  console.error('Mobile icon generation failed:', e);
  process.exit(1);
});
