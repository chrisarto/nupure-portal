// Crop white border from logo using sharp
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';

const input = 'public/logo.png';
const output = 'public/logo-cropped.png';

// Get raw pixel data
const image = sharp(input);
const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;

// Find bounding box of non-white pixels
let minX = width, maxX = 0, minY = height, maxY = 0;
const threshold = 240; // pixel brightness threshold (white = 255)

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const idx = (y * width + x) * channels;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    // Not white/near-white
    if (r < threshold || g < threshold || b < threshold) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

const padding = 20; // small padding around actual content
minX = Math.max(0, minX - padding);
minY = Math.max(0, minY - padding);
maxX = Math.min(width - 1, maxX + padding);
maxY = Math.min(height - 1, maxY + padding);

const cropWidth = maxX - minX + 1;
const cropHeight = maxY - minY + 1;

console.log(`Original: ${width}x${height}`);
console.log(`Content bounds: ${minX},${minY} → ${maxX},${maxY}`);
console.log(`Cropped: ${cropWidth}x${cropHeight}`);

await sharp(input)
  .extract({ left: minX, top: minY, width: cropWidth, height: cropHeight })
  .png()
  .toFile(output);

// Also create favicon versions
await sharp(input)
  .extract({ left: minX, top: minY, width: cropWidth, height: cropHeight })
  .resize(256, 256, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .png()
  .toFile('public/icon-cropped.png');

console.log(`✅ Saved ${output}`);
console.log(`✅ Saved public/icon-cropped.png (256x256)`);
