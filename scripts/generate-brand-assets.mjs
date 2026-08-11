import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const [iconInput, wordmarkInput] = process.argv.slice(2);

if (!iconInput || !wordmarkInput) {
  console.error('Usage: node scripts/generate-brand-assets.mjs <icon.png> <wordmark.png>');
  process.exit(1);
}

const root = process.cwd();
const publicDir = path.join(root, 'public');
const assetDir = path.join(root, 'src', 'assets');
const navy = { r: 17, g: 24, b: 39, alpha: 1 };

await mkdir(publicDir, { recursive: true });
await mkdir(assetDir, { recursive: true });

const cleanIcon = await sharp(iconInput)
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toBuffer();

const cleanWordmark = await sharp(wordmarkInput)
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toBuffer();

await writeFile(path.join(assetDir, 'fractionl-icon.png'), cleanIcon);
await writeFile(path.join(assetDir, 'fractionl-logo.png'), cleanWordmark);
await writeFile(path.join(publicDir, 'Fractionl-pulse-logo.png'), cleanWordmark);

const squareIcon = async (size) => {
  const markSize = Math.round(size * 0.64);
  const mark = await sharp(cleanIcon)
    .resize({ width: markSize, height: markSize, fit: 'inside', withoutEnlargement: false })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const metadata = await sharp(mark).metadata();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: navy,
    },
  })
    .composite([{
      input: mark,
      left: Math.round((size - (metadata.width ?? markSize)) / 2),
      top: Math.round((size - (metadata.height ?? markSize)) / 2),
    }])
    .png({ compressionLevel: 9 })
    .toBuffer();
};

const outputs = [
  [32, 'favicon.png'],
  [64, 'favicon-64.png'],
  [180, 'apple-touch-icon.png'],
  [192, 'android-chrome-192x192.png'],
  [512, 'android-chrome-512x512.png'],
];

for (const [size, filename] of outputs) {
  await writeFile(path.join(publicDir, filename), await squareIcon(size));
}

const icoSizes = [16, 32, 48];
const icoImages = await Promise.all(icoSizes.map(squareIcon));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoImages.length, 4);

let offset = 6 + (16 * icoImages.length);
const entries = icoImages.map((image, index) => {
  const size = icoSizes[index];
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0);
  entry.writeUInt8(size === 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(image.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += image.length;
  return entry;
});

await writeFile(path.join(publicDir, 'favicon.ico'), Buffer.concat([header, ...entries, ...icoImages]));

const ogImage = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="amber" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFD99A"/>
      <stop offset="1" stop-color="#FEC15F"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#111827"/>
  <circle cx="980" cy="90" r="360" fill="#FEC567" opacity="0.06"/>
  <text x="72" y="104" font-family="system-ui,-apple-system,sans-serif" font-size="22" font-weight="700" fill="#FEC567" letter-spacing="4">PULSE BY FRACTIONL</text>
  <text x="72" y="226" font-family="system-ui,-apple-system,sans-serif" font-size="68" font-weight="750" fill="#F8F4EA">The market instrument</text>
  <text x="72" y="310" font-family="system-ui,-apple-system,sans-serif" font-size="68" font-weight="750" fill="#F8F4EA">for fractional leadership.</text>
  <text x="72" y="394" font-family="system-ui,-apple-system,sans-serif" font-size="25" fill="#B9C1D0">Demand · role movement · evidence strength</text>
  <rect x="72" y="492" width="172" height="4" rx="2" fill="#FEC567"/>
  <text x="72" y="548" font-family="system-ui,-apple-system,sans-serif" font-size="20" fill="#8F9AAD">pulse.fractionl.ai</text>
  <g fill="url(#amber)" transform="translate(875 196)">
    <path d="M0 0h112v112H0z"/>
    <path d="M126 0l105 36v56l-105 20z"/>
    <path d="M0 126h112v112H0z"/>
    <path d="M126 126l45 16v48l-45 17z"/>
  </g>
</svg>
`;

await writeFile(path.join(publicDir, 'og-image.svg'), ogImage, 'utf8');

const generated = await Promise.all(outputs.map(async ([, filename]) => {
  const metadata = await sharp(await readFile(path.join(publicDir, filename))).metadata();
  return `${filename}: ${metadata.width}x${metadata.height}`;
}));

console.log(`Generated Fractionl brand assets\n${generated.join('\n')}\nog-image.svg: 1200x630`);
