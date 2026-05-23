#!/usr/bin/env node
/**
 * Convert a pmdcollab.org species ZIP to a pixel-agents pet sprite PNG.
 *
 * Usage: npx tsx scripts/convert-pmd-sprite.ts <path/to/species.zip> <speciesId>
 *
 * PMD direction row order (pmdcollab 8-direction sheet, body+shadow pairs):
 *   Dir 0=S(Down), 4=N(Up), 6=E(Right)
 *   Each direction occupies 2 rows (body + shadow). Body is the first row.
 *
 * Output: webview-ui/public/assets/pets/<speciesId>.png
 *   3 rows (Down, Up, Right) × frameCount square frames
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import { PNG } from 'pngjs';
import { DOMParser } from '@xmldom/xmldom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PMD_DOWN_DIR = 0;
const PMD_UP_DIR = 4;
const PMD_RIGHT_DIR = 6;
const PMD_DIRS_TO_EXTRACT = [PMD_DOWN_DIR, PMD_UP_DIR, PMD_RIGHT_DIR];
const PMD_ROWS_PER_DIRECTION = 2; // body row + shadow row per direction

interface AnimInfo {
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
}

function parseAnimData(xml: string): AnimInfo {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const frameWidth = parseInt(doc.getElementsByTagName('FrameWidth')[0]?.textContent ?? '24', 10);
  const frameHeight = parseInt(doc.getElementsByTagName('FrameHeight')[0]?.textContent ?? '24', 10);

  // Find Walk animation to get frame dimensions and count
  const anims = doc.getElementsByTagName('Anim');
  let frameCount = 4;
  for (let i = 0; i < anims.length; i++) {
    const nameEl = anims[i].getElementsByTagName('Name')[0];
    if (nameEl?.textContent === 'Walk') {
      frameWidth = parseInt(
        anims[i].getElementsByTagName('FrameWidth')[0]?.textContent ?? String(frameWidth),
        10,
      );
      frameHeight = parseInt(
        anims[i].getElementsByTagName('FrameHeight')[0]?.textContent ?? String(frameHeight),
        10,
      );
      frameCount = anims[i].getElementsByTagName('Duration').length;
      break;
    }
  }

  return { frameWidth, frameHeight, frameCount };
}

function main(): void {
  const [, , zipPath, speciesId] = process.argv;
  if (!zipPath || !speciesId) {
    console.error('Usage: npx tsx scripts/convert-pmd-sprite.ts <species.zip> <speciesId>');
    process.exit(1);
  }

  console.log(`Converting ${zipPath} → ${speciesId}...`);

  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  const animXmlEntry = entries.find((e) => e.entryName.endsWith('AnimData.xml'));
  const animPngEntry = entries.find((e) => e.entryName.toLowerCase().endsWith('walk-anim.png'));

  if (!animXmlEntry || !animPngEntry) {
    console.error('ZIP must contain AnimData.xml and Walk-Anim.png');
    process.exit(1);
  }

  const { frameWidth, frameHeight, frameCount } = parseAnimData(
    animXmlEntry.getData().toString('utf-8'),
  );
  console.log(`  Frame: ${frameWidth}x${frameHeight}px, ${frameCount} frames per direction`);

  const srcPng = PNG.sync.read(animPngEntry.getData());
  const frameSize = frameWidth; // output uses square frames

  const outW = frameCount * frameSize;
  const outH = 3 * frameSize; // 3 output directions
  const outPng = new PNG({ width: outW, height: outH });
  outPng.data.fill(0);

  PMD_DIRS_TO_EXTRACT.forEach((pmdDir, dstRow) => {
    const srcBodyRow = pmdDir * PMD_ROWS_PER_DIRECTION; // body row index in the PNG's row-of-rows
    const srcYStart = srcBodyRow * frameHeight; // pixel Y start in source PNG

    for (let f = 0; f < frameCount; f++) {
      for (let y = 0; y < frameSize; y++) {
        for (let x = 0; x < frameSize; x++) {
          const srcX = f * frameWidth + x;
          const srcY = srcYStart + y;
          if (srcY >= srcPng.height || srcX >= srcPng.width) continue;
          const srcIdx = (srcY * srcPng.width + srcX) * 4;
          const dstX = f * frameSize + x;
          const dstY = dstRow * frameSize + y;
          const dstIdx = (dstY * outW + dstX) * 4;
          outPng.data[dstIdx] = srcPng.data[srcIdx];
          outPng.data[dstIdx + 1] = srcPng.data[srcIdx + 1];
          outPng.data[dstIdx + 2] = srcPng.data[srcIdx + 2];
          outPng.data[dstIdx + 3] = srcPng.data[srcIdx + 3];
        }
      }
    }
  });

  const outDir = path.resolve(__dirname, '..', 'webview-ui', 'public', 'assets', 'pets');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${speciesId.toLowerCase()}.png`);
  fs.writeFileSync(outPath, PNG.sync.write(outPng));

  console.log(`Written to ${outPath} (${outW}x${outH})`);
}

main();
