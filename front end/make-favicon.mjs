import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';

const src = 'src/assets/logo.png';
const outPng = 'public/favicon.png';
const outIco = 'public/favicon.ico';

// Load image and get raw RGBA data
const img = sharp(src);
const { data, info } = await img
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;
const pixels = new Uint8Array(data.buffer);

// ---------- flood-fill white-background removal ----------
// White threshold: R,G,B all >= 240
const isWhiteLike = (i) =>
  pixels[i] >= 240 && pixels[i + 1] >= 240 && pixels[i + 2] >= 240;

// BFS from all four corners
const visited = new Uint8Array(width * height);
const queue = [];

const enqueue = (x, y) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const idx = y * width + x;
  if (visited[idx]) return;
  const pi = idx * 4;
  if (!isWhiteLike(pi)) return;
  visited[idx] = 1;
  queue.push(idx);
};

// Seed from all edge pixels that are white
for (let x = 0; x < width; x++) { enqueue(x, 0); enqueue(x, height - 1); }
for (let y = 0; y < height; y++) { enqueue(0, y); enqueue(width - 1, y); }

let head = 0;
while (head < queue.length) {
  const idx = queue[head++];
  const x = idx % width;
  const y = Math.floor(idx / width);
  enqueue(x - 1, y); enqueue(x + 1, y);
  enqueue(x, y - 1); enqueue(x, y + 1);
}

// Make all visited (background) pixels transparent
for (let i = 0; i < width * height; i++) {
  if (visited[i]) {
    pixels[i * 4 + 3] = 0; // alpha = 0
  }
}

// ---------- write transparent PNG favicon at 256×256 ----------
const transparentBuf = await sharp(Buffer.from(pixels.buffer), {
  raw: { width, height, channels: 4 },
})
  .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

writeFileSync(outPng, transparentBuf);
console.log('✓ Written', outPng);

// ---------- also write a 32×32 ICO-compatible PNG (browsers accept PNG as favicon) ----------
const ico32 = await sharp(Buffer.from(pixels.buffer), {
  raw: { width, height, channels: 4 },
})
  .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

writeFileSync(outIco, ico32);
console.log('✓ Written', outIco, '(32×32 PNG used as ICO)');
