#!/usr/bin/env node
/**
 * Generates COFFEE_MACHINE.png (32×32) — stainless steel espresso machine.
 * Silver & black with portafilter, steam wand, group head, control panel.
 *
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

const W = 32,
  H = 32;

type RGBA = [number, number, number, number];

// ── Palette ──────────────────────────────────────────────────
const T: RGBA = [0, 0, 0, 0]; // transparent
const SH: RGBA = [245, 245, 245, 255]; // silver highlight (shiniest)
const SL: RGBA = [210, 212, 215, 255]; // silver light
const SM: RGBA = [165, 168, 172, 255]; // silver mid
const SD: RGBA = [105, 108, 112, 255]; // silver dark
const SS: RGBA = [70, 72, 75, 255]; // silver shadow
const BK: RGBA = [15, 15, 18, 255]; // near-black (matte)
const BG: RGBA = [38, 38, 42, 255]; // black-grey panel fill
const BM: RGBA = [58, 58, 62, 255]; // black mid accent
const RD: RGBA = [210, 45, 45, 255]; // red LED
const GN: RGBA = [40, 185, 70, 255]; // green LED
const BL: RGBA = [55, 125, 215, 255]; // blue display
const LB: RGBA = [160, 205, 250, 255]; // light blue (screen text)
const GD: RGBA = [210, 170, 40, 255]; // gold dial face
const GE: RGBA = [145, 118, 28, 255]; // gold edge
const GS: RGBA = [240, 210, 90, 255]; // gold shine
const BR: RGBA = [38, 16, 3, 255]; // espresso brown
const CR: RGBA = [225, 228, 232, 255]; // chrome (steam wand)

// ── Draw helpers ─────────────────────────────────────────────
function sp(d: Buffer, x: number, y: number, c: RGBA): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  [d[i], d[i + 1], d[i + 2], d[i + 3]] = c;
}

function rect(d: Buffer, x1: number, y1: number, x2: number, y2: number, c: RGBA): void {
  for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) sp(d, x, y, c);
}

function hline(d: Buffer, x1: number, x2: number, y: number, c: RGBA): void {
  for (let x = x1; x <= x2; x++) sp(d, x, y, c);
}

function vline(d: Buffer, x: number, y1: number, y2: number, c: RGBA): void {
  for (let y = y1; y <= y2; y++) sp(d, x, y, c);
}

const png = new PNG({ width: W, height: H });
png.data.fill(0);
const d = png.data as unknown as Buffer;

// ─────────────────────────────────────────────────────────────
// MACHINE TOP CAP (y=0..2) — flat silver top face
// ─────────────────────────────────────────────────────────────
hline(d, 5, 26, 0, SD);
hline(d, 4, 27, 1, SM);
hline(d, 4, 27, 2, SL);
sp(d, 4, 0, SS);
sp(d, 26, 0, SS);
sp(d, 4, 1, SD);
sp(d, 27, 1, SD);
sp(d, 5, 2, SH);
sp(d, 6, 2, SH); // shine near left

// ─────────────────────────────────────────────────────────────
// WATER RESERVOIR (y=0..4, x=21..27) — raised tank on top-right
// ─────────────────────────────────────────────────────────────
rect(d, 21, 0, 27, 4, SM);
vline(d, 21, 0, 4, SS); // left shadow
vline(d, 27, 0, 4, SH); // right shine
hline(d, 22, 26, 0, SH); // top face highlight
hline(d, 21, 27, 4, SD); // bottom edge
// Reservoir label line
hline(d, 22, 26, 2, BM);

// ─────────────────────────────────────────────────────────────
// CHROME BODY SIDES (y=3..21)
// ─────────────────────────────────────────────────────────────
// Left chrome pillar
vline(d, 4, 3, 21, SS);
vline(d, 5, 3, 21, SD);
vline(d, 6, 3, 21, SM);
vline(d, 7, 3, 21, SL);
sp(d, 7, 3, SH);
sp(d, 7, 4, SH);
sp(d, 7, 5, SH);

// Right chrome pillar
vline(d, 23, 3, 21, SL);
vline(d, 24, 3, 21, SM);
vline(d, 25, 3, 21, SD);
vline(d, 26, 3, 21, SS);
sp(d, 23, 3, SH);
sp(d, 23, 4, SH);
sp(d, 23, 5, SH);

// ─────────────────────────────────────────────────────────────
// BLACK FRONT PANEL (x=8..22, y=3..16)
// ─────────────────────────────────────────────────────────────
rect(d, 8, 3, 22, 16, BK);
// Panel top bevel
hline(d, 8, 22, 3, BM);
hline(d, 8, 22, 4, BG);
// Panel left/right inner edge
vline(d, 8, 3, 16, BM);
vline(d, 22, 3, 16, BM);

// ── Brand bar with LED indicators (y=4..5) ───────────────────
rect(d, 9, 4, 21, 5, BG);
// Three LEDs
sp(d, 10, 4, RD);
sp(d, 10, 5, BG);
sp(d, 12, 4, GN);
sp(d, 12, 5, BG);
sp(d, 14, 4, BL);
sp(d, 14, 5, BG);
// LED glow hints
sp(d, 9, 4, BG);
sp(d, 11, 4, BG);
sp(d, 13, 4, BG);

// ── LCD display (x=9..18, y=6..8) ────────────────────────────
rect(d, 9, 6, 18, 8, BM); // bezel
rect(d, 10, 6, 17, 8, BL); // screen
// Temp readout pixels (two glowing digit groups)
hline(d, 10, 11, 7, LB);
sp(d, 10, 6, LB);
sp(d, 11, 6, LB);
sp(d, 10, 8, LB);
sp(d, 11, 8, LB);
hline(d, 13, 14, 7, LB);
sp(d, 13, 6, LB);
sp(d, 14, 6, LB);
sp(d, 13, 8, LB);
sp(d, 14, 8, LB);
sp(d, 16, 7, LB); // degree symbol

// ── Pressure / volume dial (x=19..22, y=5..9) ────────────────
rect(d, 19, 5, 22, 9, BG); // recess
sp(d, 20, 5, GD);
sp(d, 21, 5, GD);
sp(d, 19, 6, GE);
sp(d, 20, 6, GS);
sp(d, 21, 6, GD);
sp(d, 22, 6, GE);
sp(d, 19, 7, GE);
sp(d, 20, 7, GD);
sp(d, 21, 7, GD);
sp(d, 22, 7, GE);
sp(d, 19, 8, GE);
sp(d, 20, 8, GD);
sp(d, 21, 8, GS);
sp(d, 22, 8, GE);
sp(d, 20, 9, GE);
sp(d, 21, 9, GE);

// ── Single / double espresso buttons (y=10..12) ──────────────
// 1-cup button
rect(d, 9, 10, 12, 12, BM);
rect(d, 10, 10, 11, 11, SM);
sp(d, 10, 10, SH);
sp(d, 11, 10, SD);

// 2-cup button
rect(d, 14, 10, 18, 12, BM);
rect(d, 15, 10, 17, 11, SM);
sp(d, 15, 10, SH);
sp(d, 17, 10, SD);

// ── Steam / froth selector knob (x=9..11, y=13..15) ──────────
rect(d, 9, 13, 11, 15, BG);
sp(d, 9, 13, SD);
sp(d, 11, 13, SM);
sp(d, 9, 14, SD);
sp(d, 10, 14, SH);
sp(d, 11, 14, SD);
sp(d, 9, 15, SS);
sp(d, 10, 15, SM);
sp(d, 11, 15, SS);

// ─────────────────────────────────────────────────────────────
// STEAM WAND (left side; steam effect renders at col+0.5 = left tile center)
// ─────────────────────────────────────────────────────────────
// Horizontal arm (y=7..8, x=2..7)
hline(d, 2, 7, 7, SH);
hline(d, 2, 7, 8, CR);
sp(d, 2, 7, SM);
sp(d, 7, 7, SD);
sp(d, 2, 8, SD);
sp(d, 7, 8, SD);

// Pivot point at x=5..6, y=7..9
sp(d, 5, 9, CR);
sp(d, 6, 9, SM);

// Wand rod (x=2..3, y=9..17)
vline(d, 2, 9, 17, CR);
vline(d, 3, 9, 17, SM);
sp(d, 2, 9, SH);
sp(d, 3, 9, CR);
sp(d, 2, 17, SD);
sp(d, 3, 17, SS);

// Nozzle tip (x=1..4, y=17..18)
rect(d, 1, 17, 4, 18, SM);
hline(d, 1, 4, 17, SH);
hline(d, 1, 4, 18, SD);
sp(d, 1, 18, SS);
sp(d, 4, 18, SS);
// Nozzle holes
sp(d, 1, 19, SD);
sp(d, 3, 19, SD);

// ─────────────────────────────────────────────────────────────
// GROUP HEAD (y=17..20, x=9..22) — the chrome brew head
// ─────────────────────────────────────────────────────────────
rect(d, 9, 17, 22, 19, SM);
hline(d, 9, 22, 17, SH);
hline(d, 9, 22, 19, SD);
vline(d, 9, 17, 19, SS);
vline(d, 22, 17, 19, SH);

// Shower screen (black face with perforations)
rect(d, 10, 17, 21, 18, BK);
for (let x = 11; x <= 20; x += 2) sp(d, x, 17, BM);
for (let x = 12; x <= 19; x += 2) sp(d, x, 18, BM);

// Group head bottom face
rect(d, 10, 20, 21, 20, SM);
hline(d, 10, 21, 20, SD);

// ─────────────────────────────────────────────────────────────
// PORTAFILTER (y=20..27)
// ─────────────────────────────────────────────────────────────
// Locking collar
rect(d, 11, 20, 20, 21, SM);
hline(d, 11, 20, 20, SH);
hline(d, 11, 20, 21, SD);
sp(d, 10, 20, SM);
sp(d, 21, 20, SM); // locking ears

// Filter basket (x=12..19, y=21..24) with slight taper
rect(d, 12, 21, 19, 24, SM);
hline(d, 12, 19, 21, SH);
vline(d, 12, 21, 24, SD);
vline(d, 19, 21, 24, SH);
hline(d, 12, 19, 24, SD);

// Coffee puck inside
rect(d, 13, 22, 18, 23, BR);
hline(d, 13, 18, 22, BG);

// Handle (extends RIGHT, x=19..27, y=21..22)
rect(d, 19, 21, 27, 22, SM);
hline(d, 19, 27, 21, SH);
hline(d, 19, 27, 22, SD);
sp(d, 27, 21, SD);
sp(d, 27, 22, SS);
// Grip ridges
for (let x = 21; x <= 26; x += 2) sp(d, x, 21, SD);

// Two espresso spouts
vline(d, 14, 24, 26, SD);
vline(d, 17, 24, 26, SD);
sp(d, 14, 26, SS);
sp(d, 17, 26, SS);
sp(d, 14, 27, BR);
sp(d, 17, 27, BR); // drip

// ─────────────────────────────────────────────────────────────
// DRIP TRAY (y=25..29, x=4..27)
// ─────────────────────────────────────────────────────────────
hline(d, 4, 27, 25, SM); // rim
sp(d, 4, 25, SD);
sp(d, 27, 25, SH);

// Tray body
rect(d, 4, 26, 27, 29, BK);
hline(d, 4, 27, 26, BG);
// Grate bars
for (let x = 6; x <= 26; x += 3) {
  sp(d, x, 26, BM);
  sp(d, x, 27, SM);
  sp(d, x, 28, BM);
}
for (let x = 7; x <= 26; x += 3) sp(d, x, 27, SL);

// Tray frame
vline(d, 4, 26, 29, SD);
vline(d, 27, 26, 29, SD);
hline(d, 4, 27, 29, SD);

// ─────────────────────────────────────────────────────────────
// BASE / FEET (y=30..31)
// ─────────────────────────────────────────────────────────────
hline(d, 5, 26, 30, SM);
// Left foot
rect(d, 5, 30, 9, 31, BK);
sp(d, 5, 30, BM);
sp(d, 9, 30, BM);
// Right foot
rect(d, 17, 30, 21, 31, BK);
sp(d, 17, 30, BM);
sp(d, 21, 30, BM);

// ─────────────────────────────────────────────────────────────
// Write PNG
// ─────────────────────────────────────────────────────────────
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, PNG.sync.write(png));
console.log(`Written: ${OUT} (${W}×${H})`);
