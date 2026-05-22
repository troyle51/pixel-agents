#!/usr/bin/env node
/**
 * Generates COFFEE_MACHINE.png — a 16×32 pixel art espresso machine.
 * Run: npx tsx scripts/generate-coffee-machine.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(
  __dirname,
  '../webview-ui/public/assets/furniture/COFFEE_MACHINE/COFFEE_MACHINE.png',
);

const W = 16,
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

// Machine body (dark chrome): rows 10-28, cols 3-12
for (let y = 10; y <= 28; y++) for (let x = 3; x <= 12; x++) px(x, y, 70, 70, 80);
// Front panel (lighter): rows 13-24, cols 4-11
for (let y = 13; y <= 24; y++) for (let x = 4; x <= 11; x++) px(x, y, 95, 95, 110);
// Top (slightly rounded): row 10, cols 4-11
for (let x = 4; x <= 11; x++) px(x, 10, 50, 50, 60);
// Water reservoir (blue tint) top: rows 8-10, cols 5-10
for (let y = 8; y <= 10; y++) for (let x = 5; x <= 10; x++) px(x, y, 40, 80, 140, 200);
// Screen/display (green LED): rows 14-16, cols 5-10
for (let y = 14; y <= 16; y++) for (let x = 5; x <= 10; x++) px(x, y, 0, 180, 50);
// Button row: row 19, cols 5, 7, 9
[5, 7, 9].forEach((x) => {
  px(x, 19, 220, 50, 50);
  px(x + 1, 19, 220, 50, 50);
});
// Drip tray: rows 25-27, cols 3-12 (darker)
for (let y = 25; y <= 27; y++) for (let x = 3; x <= 12; x++) px(x, y, 45, 45, 55);
// Cup slot: rows 22-24, cols 6-9 (hollow dark)
for (let y = 22; y <= 24; y++) for (let x = 6; x <= 9; x++) px(x, y, 30, 30, 35);
// Machine sides highlight
for (let y = 11; y <= 27; y++) {
  px(3, y, 110, 110, 120);
  px(12, y, 50, 50, 58);
}
// Shadow
for (let x = 4; x <= 12; x++) px(x, 29, 0, 0, 0, 50);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, PNG.sync.write(png));
console.log('Written:', OUT);
