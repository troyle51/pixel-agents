/**
 * Generate additional character skin PNGs by applying HSL transforms to existing bases.
 *
 * Reads char_0.png–char_5.png from webview-ui/public/assets/characters/ and writes
 * char_6.png–char_11.png with distinct color themes.
 *
 * Usage: npx tsx scripts/generate-character-variants.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHARS_DIR = path.resolve(__dirname, '..', 'webview-ui', 'public', 'assets', 'characters');

interface Transform {
  /** Source char index (0-5) */
  source: number;
  /** Hue shift in degrees (-180 to +180) */
  h: number;
  /** Saturation shift (-100 to +100) */
  s: number;
  /** Brightness shift (-100 to +100) */
  b: number;
  /** Contrast shift (-100 to +100) */
  c: number;
  label: string;
}

// 6 new skins: one per base, each with a distinctive transform
const VARIANTS: Transform[] = [
  { source: 0, h: 120, s: 15, b: 0, c: 5, label: 'forest-green' },
  { source: 1, h: 180, s: 10, b: 0, c: 0, label: 'complementary' },
  { source: 2, h: -90, s: 20, b: 0, c: 0, label: 'ocean-blue' },
  { source: 3, h: 55, s: 30, b: -5, c: 10, label: 'golden-sunny' },
  { source: 4, h: 150, s: 25, b: 0, c: 0, label: 'magenta-pink' },
  { source: 5, h: 0, s: -55, b: 12, c: -15, label: 'silver-pastel' },
];

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rf = r / 255,
    gf = g / 255,
    bf = b / 255;
  const max = Math.max(rf, gf, bf),
    min = Math.min(rf, gf, bf);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rf) h = ((gf - bf) / d + (gf < bf ? 6 : 0)) * 60;
  else if (max === gf) h = ((bf - rf) / d + 2) * 60;
  else h = ((rf - gf) / d + 4) * 60;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c2 = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c2 * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0,
    g1 = 0,
    b1 = 0;
  if (hp < 1) {
    r1 = c2;
    g1 = x;
  } else if (hp < 2) {
    r1 = x;
    g1 = c2;
  } else if (hp < 3) {
    g1 = c2;
    b1 = x;
  } else if (hp < 4) {
    g1 = x;
    b1 = c2;
  } else if (hp < 5) {
    r1 = x;
    b1 = c2;
  } else {
    r1 = c2;
    b1 = x;
  }
  const m = l - c2 / 2;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round((v + m) * 255)));
  return [clamp(r1), clamp(g1), clamp(b1)];
}

function applyTransform(src: PNG, t: Transform): PNG {
  const dst = new PNG({ width: src.width, height: src.height });
  for (let i = 0; i < src.data.length; i += 4) {
    const r = src.data[i],
      g = src.data[i + 1],
      b = src.data[i + 2],
      a = src.data[i + 3];

    if (a === 0) {
      dst.data[i] = dst.data[i + 1] = dst.data[i + 2] = dst.data[i + 3] = 0;
      continue;
    }

    let [origH, origS, origL] = rgbToHsl(r, g, b);

    // Hue rotate
    const newH = (((origH + t.h) % 360) + 360) % 360;

    // Saturation shift
    const newS = Math.max(0, Math.min(1, origS + t.s / 100));

    // Contrast around midpoint
    let lightness = origL;
    if (t.c !== 0) {
      const factor = (100 + t.c) / 100;
      lightness = 0.5 + (lightness - 0.5) * factor;
    }

    // Brightness shift
    if (t.b !== 0) lightness = lightness + t.b / 200;
    lightness = Math.max(0, Math.min(1, lightness));

    const [nr, ng, nb] = hslToRgb(newH, newS, lightness);
    dst.data[i] = nr;
    dst.data[i + 1] = ng;
    dst.data[i + 2] = nb;
    dst.data[i + 3] = a;
  }
  return dst;
}

async function main(): Promise<void> {
  for (let vi = 0; vi < VARIANTS.length; vi++) {
    const t = VARIANTS[vi];
    const dstIndex = 6 + vi;
    const srcPath = path.join(CHARS_DIR, `char_${t.source}.png`);
    const dstPath = path.join(CHARS_DIR, `char_${dstIndex}.png`);

    const srcBuf = fs.readFileSync(srcPath);
    const src = PNG.sync.read(srcBuf);
    const dst = applyTransform(src, t);
    fs.writeFileSync(dstPath, PNG.sync.write(dst));
    console.log(
      `  ✅ char_${dstIndex}.png  [${t.label}]  (source: char_${t.source}, h:${t.h > 0 ? '+' : ''}${t.h} s:${t.s > 0 ? '+' : ''}${t.s} b:${t.b > 0 ? '+' : ''}${t.b} c:${t.c > 0 ? '+' : ''}${t.c})`,
    );
  }
  console.log('\nDone. Update CHAR_COUNT and PALETTE_COUNT, then rebuild.');
}

main().catch(console.error);
