#!/usr/bin/env node
/**
 * Extends character sprite sheets from 112×96 (7 frames) to 144×96 (9 frames)
 * by appending wind-up (swing1) and follow-through (swing2) frames.
 * Run: npx tsx scripts/add-swing-frames.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHARS_DIR = path.resolve(__dirname, '../webview-ui/public/assets/characters');

const W_OLD = 112,
  W_NEW = 144,
  H = 96;
const FW = 16,
  FH = 32;
// Direction row offsets in pixels
const ROWS = { down: 0, up: FH, right: FH * 2 };

// Sample a pixel from the source PNG (returns [r,g,b,a])
function samplePixel(
  data: Buffer,
  width: number,
  px: number,
  py: number,
): [number, number, number, number] {
  const i = (py * width + px) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

// Write a pixel into dest PNG data
function writePixel(
  data: Buffer,
  width: number,
  px: number,
  py: number,
  rgba: [number, number, number, number],
): void {
  const i = (py * width + px) * 4;
  [data[i], data[i + 1], data[i + 2], data[i + 3]] = rgba;
}

function toRgba(r: number, g: number, b: number, a = 255): [number, number, number, number] {
  return [r, g, b, a];
}

const TRANSPARENT: [number, number, number, number] = [0, 0, 0, 0];

// Swing frame pixel definitions.
type ColorKey = 'skin' | 'hair' | 'body' | 'leg' | 'shoe' | 'paddle_handle' | 'paddle_face';

const SWING1_PIXELS: Array<[number, number, ColorKey]> = [
  // Shoes (rows 29-31)
  ...[29, 30, 31].flatMap((y) =>
    [4, 5, 6, 7, 8].map((x) => [x, y, 'shoe'] as [number, number, ColorKey]),
  ),
  // Legs (rows 23-28)
  ...[23, 24, 25, 26, 27, 28].flatMap(
    (y) =>
      [
        [4, y, 'leg'],
        [5, y, 'leg'],
        [7, y, 'leg'],
        [8, y, 'leg'],
      ] as Array<[number, number, ColorKey]>,
  ),
  // Body leaning back (rows 14-22)
  ...[14, 15, 16, 17, 18, 19, 20, 21, 22].flatMap((y) =>
    [3, 4, 5, 6, 7, 8].map((x) => [x, y, 'body'] as [number, number, ColorKey]),
  ),
  // Arm pulled back (rows 16-18, col 2)
  [2, 16, 'skin'],
  [2, 17, 'skin'],
  [2, 18, 'skin'],
  // Paddle handle (rows 16-17, cols 0-1)
  [1, 16, 'paddle_handle'],
  [1, 17, 'paddle_handle'],
  [0, 17, 'paddle_handle'],
  // Paddle face (rows 14-16)
  [0, 14, 'paddle_face'],
  [0, 15, 'paddle_face'],
  [0, 16, 'paddle_face'],
  [1, 14, 'paddle_face'],
  [1, 15, 'paddle_face'],
  // Head (rows 8-14)
  ...[8, 9, 10, 11, 12, 13, 14].flatMap((y) =>
    [4, 5, 6, 7].map((x) => [x, y, 'skin'] as [number, number, ColorKey]),
  ),
  // Hair (rows 8-9)
  ...[8, 9].flatMap((y) => [4, 5, 6, 7].map((x) => [x, y, 'hair'] as [number, number, ColorKey])),
];

const SWING2_PIXELS: Array<[number, number, ColorKey]> = [
  // Shoes wider apart (rows 29-31)
  ...[29, 30, 31].flatMap((y) =>
    [6, 7, 8, 9, 10, 11].map((x) => [x, y, 'shoe'] as [number, number, ColorKey]),
  ),
  // Legs (rows 23-28) wider
  ...[23, 24, 25, 26, 27, 28].flatMap(
    (y) =>
      [
        [6, y, 'leg'],
        [7, y, 'leg'],
        [10, y, 'leg'],
        [11, y, 'leg'],
      ] as Array<[number, number, ColorKey]>,
  ),
  // Body lunging forward (rows 14-22)
  ...[14, 15, 16, 17, 18, 19, 20, 21, 22].flatMap((y) =>
    [7, 8, 9, 10, 11, 12, 13].map((x) => [x, y, 'body'] as [number, number, ColorKey]),
  ),
  // Arm extended (rows 15-17, cols 14-15)
  [14, 15, 'skin'],
  [15, 15, 'skin'],
  [14, 16, 'skin'],
  [15, 16, 'skin'],
  // Paddle handle
  [14, 16, 'paddle_handle'],
  [15, 16, 'paddle_handle'],
  // Paddle face extended (rows 12-16, cols 13-15)
  ...[12, 13, 14, 15, 16].flatMap((y) =>
    [14, 15].map((x) => [x, y, 'paddle_face'] as [number, number, ColorKey]),
  ),
  [13, 12, 'paddle_face'],
  [13, 13, 'paddle_face'],
  // Head forward (rows 8-14)
  ...[8, 9, 10, 11, 12, 13, 14].flatMap((y) =>
    [9, 10, 11, 12].map((x) => [x, y, 'skin'] as [number, number, ColorKey]),
  ),
  // Hair (rows 8-9)
  ...[8, 9].flatMap((y) =>
    [9, 10, 11, 12].map((x) => [x, y, 'hair'] as [number, number, ColorKey]),
  ),
];

interface Colors {
  skin: [number, number, number, number];
  hair: [number, number, number, number];
  body: [number, number, number, number];
  leg: [number, number, number, number];
  shoe: [number, number, number, number];
  paddle_handle: [number, number, number, number];
  paddle_face: [number, number, number, number];
}

function sampleColors(data: Buffer, width: number): Colors {
  // Sample from right-direction row (y offset 64), typing frame 1 (x offset 48)
  const baseX = 48,
    baseY = 64;
  return {
    skin: samplePixel(data, width, baseX + 8, baseY + 10),
    hair: samplePixel(data, width, baseX + 8, baseY + 9),
    body: samplePixel(data, width, baseX + 5, baseY + 18),
    leg: samplePixel(data, width, baseX + 6, baseY + 25),
    shoe: samplePixel(data, width, baseX + 6, baseY + 30),
    paddle_handle: toRgba(139, 69, 19),
    paddle_face: toRgba(204, 51, 51),
  };
}

function drawFrame(
  dest: Buffer,
  destWidth: number,
  frameCol: number,
  dirRow: number,
  pixels: Array<[number, number, ColorKey]>,
  colors: Colors,
): void {
  const originX = frameCol * FW;
  const originY = dirRow;
  for (let y = 0; y < FH; y++) {
    for (let x = 0; x < FW; x++) {
      writePixel(dest, destWidth, originX + x, originY + y, TRANSPARENT);
    }
  }
  for (const [lx, ly, key] of pixels) {
    writePixel(dest, destWidth, originX + lx, originY + ly, colors[key]);
  }
}

const files = fs
  .readdirSync(CHARS_DIR)
  .filter((f) => /^char_\d+\.png$/.test(f))
  .sort();
console.log(`Processing ${files.length} character sprites...`);

for (const file of files) {
  const srcPath = path.join(CHARS_DIR, file);
  const src = PNG.sync.read(fs.readFileSync(srcPath));

  if (src.width !== W_OLD || src.height !== H) {
    console.log(`  ${file}: unexpected size ${src.width}×${src.height}, skipping`);
    continue;
  }

  const dest = new PNG({ width: W_NEW, height: H });
  // Copy existing pixels
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W_OLD; x++) {
      const si = (y * W_OLD + x) * 4;
      const di = (y * W_NEW + x) * 4;
      dest.data[di] = src.data[si];
      dest.data[di + 1] = src.data[si + 1];
      dest.data[di + 2] = src.data[si + 2];
      dest.data[di + 3] = src.data[si + 3];
    }
  }

  const colors = sampleColors(src.data as unknown as Buffer, W_OLD);

  // Draw swing frames for each direction row (frame index 7 = swing1, 8 = swing2)
  for (const rowY of Object.values(ROWS)) {
    drawFrame(dest.data as unknown as Buffer, W_NEW, 7, rowY, SWING1_PIXELS, colors);
    drawFrame(dest.data as unknown as Buffer, W_NEW, 8, rowY, SWING2_PIXELS, colors);
  }

  fs.writeFileSync(srcPath, PNG.sync.write(dest));
  console.log(`  ${file}: expanded to 144×96`);
}
console.log('Done.');
