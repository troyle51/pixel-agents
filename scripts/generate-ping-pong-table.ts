#!/usr/bin/env node
/**
 * Generates PING_PONG_TABLE.png — a 32×16 pixel art ping pong table.
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

const W = 32,
  H = 16;
const png = new PNG({ width: W, height: H });

// Fill transparent
for (let i = 0; i < png.data.length; i++) png.data[i] = 0;

function px(x: number, y: number, r: number, g: number, b: number, a = 255): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  png.data[i] = r;
  png.data[i + 1] = g;
  png.data[i + 2] = b;
  png.data[i + 3] = a;
}

// Table surface (green): rows 6-10, cols 2-29
for (let y = 6; y <= 10; y++) {
  for (let x = 2; x <= 29; x++) {
    px(x, y, 45, 122, 58);
  }
}
// White center line: col 15-16, rows 6-10
for (let y = 6; y <= 10; y++) {
  px(15, y, 255, 255, 255);
  px(16, y, 255, 255, 255);
}
// Net: col 15-16, rows 4-6 (stands above table)
for (let y = 4; y <= 6; y++) {
  px(15, y, 230, 230, 230);
  px(16, y, 230, 230, 230);
}
// Table border: dark green outline
for (let x = 2; x <= 29; x++) {
  px(x, 6, 28, 80, 38);
  px(x, 10, 28, 80, 38);
}
for (let y = 6; y <= 10; y++) {
  px(2, y, 28, 80, 38);
  px(29, y, 28, 80, 38);
}
// Table legs: 4 corners
[
  [3, 11],
  [3, 12],
  [3, 13],
  [28, 11],
  [28, 12],
  [28, 13],
].forEach(([x, y]) => px(x, y, 80, 50, 30));
// Shadow under table
for (let x = 4; x <= 28; x++) {
  px(x, 14, 0, 0, 0, 40);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, PNG.sync.write(png));
console.log('Written:', OUT);
