#!/usr/bin/env node
/**
 * Rewrites frames 7-8 (ping pong) and adds frames 9-10 (whiteboard)
 * to all character PNGs, extending sheets from 144×96 → 176×96 (11 frames).
 *
 * Strategy: copy the real walk[1] pose as base, then overlay
 * arm + paddle / arm + marker pixels so body/face stays consistent.
 *
 * Run: npx tsx scripts/generate-activity-frames.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHARS_DIR = path.resolve(__dirname, '../webview-ui/public/assets/characters');

const FW = 16,
  FH = 32,
  H = 96;
const W_OUT = 176; // 11 frames × 16px

type RGBA = [number, number, number, number];
const T: RGBA = [0, 0, 0, 0];

// ── Paddle colors ─────────────────────────────────────────────
const PF_E: RGBA = [148, 22, 22, 255]; // dark red edge
const PF_M: RGBA = [212, 52, 52, 255]; // main red face
const PF_L: RGBA = [244, 118, 118, 255]; // light highlight
const PH_M: RGBA = [128, 74, 24, 255]; // handle brown
const PH_D: RGBA = [88, 50, 14, 255]; // handle dark

// ── Marker colors ─────────────────────────────────────────────
const MK_T: RGBA = [28, 28, 96, 255]; // tip (dark blue)
const MK_B: RGBA = [62, 62, 192, 255]; // body (blue)
const MK_C: RGBA = [212, 212, 212, 255]; // cap (silver)

// ─────────────────────────────────────────────────────────────

function px(data: Buffer, w: number, x: number, y: number): RGBA {
  if (x < 0 || x >= w || y < 0 || y >= H) return T;
  const i = (y * w + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

function sp(data: Buffer, w: number, x: number, y: number, c: RGBA): void {
  if (x < 0 || x >= w || y < 0 || y >= H) return;
  const i = (y * w + x) * 4;
  [data[i], data[i + 1], data[i + 2], data[i + 3]] = c;
}

function copyFrame(
  src: Buffer,
  srcW: number,
  srcFc: number,
  srcDy: number,
  dst: Buffer,
  dstFc: number,
  dstDy: number,
): void {
  for (let r = 0; r < FH; r++)
    for (let c = 0; c < FW; c++)
      sp(dst, W_OUT, dstFc * FW + c, dstDy + r, px(src, srcW, srcFc * FW + c, srcDy + r));
}

/** Sample skin from face-center of down walk[0]. */
function sampleSkin(src: Buffer, srcW: number): RGBA {
  return px(src, srcW, 7, 10);
}

/**
 * 3×7 paddle: 3×5 red face (edge/highlight/main) + 1×2 brown handle.
 * cx = horizontal center (absolute x in dest PNG), fy = face top (absolute y).
 */
function drawPaddle(dst: Buffer, cx: number, fy: number): void {
  // face rows
  const face: RGBA[][] = [
    [PF_E, PF_L, PF_E],
    [PF_E, PF_M, PF_E],
    [PF_E, PF_M, PF_E],
    [PF_E, PF_M, PF_E],
    [PF_E, PF_E, PF_E],
  ];
  for (let r = 0; r < 5; r++)
    for (let dc = -1; dc <= 1; dc++) sp(dst, W_OUT, cx + dc, fy + r, face[r][dc + 1]);
  // handle
  sp(dst, W_OUT, cx, fy + 5, PH_M);
  sp(dst, W_OUT, cx, fy + 6, PH_D);
}

/** Draw marker tip-up: tip at (ax, ay), body below, cap at bottom. */
function drawMarker(dst: Buffer, ax: number, ay: number): void {
  sp(dst, W_OUT, ax, ay, MK_T);
  sp(dst, W_OUT, ax, ay + 1, MK_B);
  sp(dst, W_OUT, ax, ay + 2, MK_B);
  sp(dst, W_OUT, ax, ay + 3, MK_C);
}

/** Bresenham line of skin pixels from (x1,y1) → (x2,y2). */
function drawArm(dst: Buffer, skin: RGBA, x1: number, y1: number, x2: number, y2: number): void {
  const dx = x2 - x1,
    dy = y2 - y1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    sp(dst, W_OUT, Math.round(x1 + dx * t), Math.round(y1 + dy * t), skin);
  }
}

// ─────────────────────────────────────────────────────────────

const files = fs
  .readdirSync(CHARS_DIR)
  .filter((f) => /^char_\d+\.png$/.test(f))
  .sort();

console.log(`Processing ${files.length} character sprites...`);

for (const file of files) {
  const srcPath = path.join(CHARS_DIR, file);
  const src = PNG.sync.read(fs.readFileSync(srcPath));
  if (src.height !== H) {
    console.log(`  ${file}: unexpected height, skipping`);
    continue;
  }

  const dst = new PNG({ width: W_OUT, height: H });
  dst.data.fill(0);

  const s = src.data as unknown as Buffer;
  const d = dst.data as unknown as Buffer;
  const skin = sampleSkin(s, src.width);
  const dirs = [0, FH, FH * 2] as const; // down=0, up=32, right=64

  // Copy frames 0-6 unchanged
  for (const dy of dirs)
    for (let fc = 0; fc < 7 && fc * FW < src.width; fc++)
      copyFrame(s, src.width, fc, dy, d, fc, dy);

  // ── Frame 7: Ping pong WINDUP ──────────────────────────────
  // Base: walk[1] in all directions
  for (const dy of dirs) copyFrame(s, src.width, 1, dy, d, 7, dy);
  // Right direction: paddle pulled back-left
  {
    const bx = 7 * FW; // = 112 (frame 7 left edge)
    const dy = FH * 2; // right direction y = 64
    // Arm: shoulder col 4 row 16 → near paddle col 2 row 19
    drawArm(d, skin, bx + 4, dy + 16, bx + 2, dy + 19);
    // Paddle centered col 1, face top row 13  →  cols 0-2, rows 13-19
    drawPaddle(d, bx + 1, dy + 13);
  }

  // ── Frame 8: Ping pong FOLLOWTHROUGH ──────────────────────
  for (const dy of dirs) copyFrame(s, src.width, 1, dy, d, 8, dy);
  // Right direction: paddle pushed forward-right
  {
    const bx = 8 * FW; // = 128
    const dy = FH * 2;
    // Arm: shoulder col 9 row 16 → paddle col 12 row 15
    drawArm(d, skin, bx + 9, dy + 16, bx + 12, dy + 15);
    // Paddle centered col 13, face top row 11  →  cols 12-14, rows 11-17
    drawPaddle(d, bx + 13, dy + 11);
  }

  // ── Frame 9: Whiteboard PRESENTER ─────────────────────────
  for (const dy of dirs) copyFrame(s, src.width, 1, dy, d, 9, dy);
  // Up direction: right arm raised with marker
  {
    const bx = 9 * FW; // = 144
    const dy = FH; // up direction y = 32
    // Arm: shoulder col 10 row 15 → raised tip col 11 row 10
    drawArm(d, skin, bx + 10, dy + 15, bx + 11, dy + 10);
    // Marker tip at (col 11, row 8), body rows 8-11
    drawMarker(d, bx + 11, dy + 8);
  }

  // ── Frame 10: Whiteboard AUDIENCE ─────────────────────────
  for (const dy of dirs) copyFrame(s, src.width, 1, dy, d, 10, dy);
  // Up direction: arms relaxed at sides to look attentive/watching
  {
    const bx = 10 * FW; // = 160
    const dy = FH;
    // Left arm slightly out
    sp(d, W_OUT, bx + 3, dy + 17, skin);
    sp(d, W_OUT, bx + 3, dy + 18, skin);
    // Right arm slightly out
    sp(d, W_OUT, bx + 11, dy + 17, skin);
    sp(d, W_OUT, bx + 11, dy + 18, skin);
  }

  fs.writeFileSync(srcPath, PNG.sync.write(dst));
  console.log(`  ${file}: → ${W_OUT}×${H}`);
}

console.log('Done.');
