#!/usr/bin/env node
/**
 * Generates PING_PONG_TABLE.png — a 64×32 pixel art ping pong table (4×2 tiles).
 * Run: npx tsx scripts/generate-ping-pong-table.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(
  __dirname,
  '../webview-ui/public/assets/furniture/PING_PONG_TABLE/PING_PONG_TABLE.png',
);

const W = 64,
  H = 32;
const png = new PNG({ width: W, height: H });

for (let i = 0; i < png.data.length; i++) png.data[i] = 0;

function px(x: number, y: number, r: number, g: number, b: number, a = 255): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  png.data[i] = r;
  png.data[i + 1] = g;
  png.data[i + 2] = b;
  png.data[i + 3] = a;
}

function rect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): void {
  for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) px(x, y, r, g, b, a);
}

// Table surface (green): 4px padding on sides, occupies most of the height
rect(4, 12, 59, 22, 45, 122, 58);

// Table border (dark green outline)
for (let x = 4; x <= 59; x++) {
  px(x, 12, 28, 80, 38);
  px(x, 22, 28, 80, 38);
}
for (let y = 12; y <= 22; y++) {
  px(4, y, 28, 80, 38);
  px(59, y, 28, 80, 38);
}

// White center line (vertical, 2px wide)
for (let y = 12; y <= 22; y++) {
  px(31, y, 255, 255, 255);
  px(32, y, 255, 255, 255);
}

// Net posts (2px × 3px each side of center line)
rect(29, 9, 30, 12, 180, 140, 80);
rect(33, 9, 34, 12, 180, 140, 80);

// Net mesh (grey, between posts, above table)
for (let y = 9; y <= 11; y++) {
  px(31, y, 210, 210, 210);
  px(32, y, 210, 210, 210);
}
// Net top bar
px(29, 9, 200, 160, 90);
px(30, 9, 200, 160, 90);
px(31, 9, 200, 160, 90);
px(32, 9, 200, 160, 90);
px(33, 9, 200, 160, 90);
px(34, 9, 200, 160, 90);

// Table legs (4 corners, below table)
rect(5, 23, 6, 27, 80, 50, 30);
rect(57, 23, 58, 27, 80, 50, 30);

// Shadow
for (let x = 6; x <= 58; x++) {
  px(x, 28, 0, 0, 0, 35);
  px(x, 29, 0, 0, 0, 20);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, PNG.sync.write(png));
console.log('Written:', OUT);
