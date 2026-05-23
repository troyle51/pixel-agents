/**
 * Download and convert starter pet sprites from PMDCollab/SpriteCollab on GitHub.
 * Fetches WanderingAround-Anim.png + AnimData.xml for each species and writes
 * a 3-row pet PNG to webview-ui/public/assets/pets/<name>.png.
 *
 * Usage: npx tsx scripts/download-starter-pets.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';
import { DOMParser } from '@xmldom/xmldom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite';

const SPECIES: Array<{ num: string; name: string }> = [
  { num: '0025', name: 'pikachu' },
  { num: '0133', name: 'eevee' },
  { num: '0054', name: 'psyduck' },
  { num: '0039', name: 'jigglypuff' },
  { num: '0052', name: 'meowth' },
];

const PMD_DIRS_TO_EXTRACT = [0, 4, 2]; // Down, Up, Right — S(0)=Down, N(4)=Up, E(2)=Right
const PMD_ROWS_PER_DIRECTION = 2;

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function parseAnimData(xml: string): {
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
} {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  // Walk animation has its own FrameWidth/FrameHeight inside the <Anim> block
  const anims = doc.getElementsByTagName('Anim');
  let frameWidth = 24;
  let frameHeight = 24;
  let frameCount = 4;
  for (let i = 0; i < anims.length; i++) {
    const nameEl = anims[i].getElementsByTagName('Name')[0];
    if (nameEl?.textContent === 'Walk') {
      frameWidth = parseInt(
        anims[i].getElementsByTagName('FrameWidth')[0]?.textContent ?? '24',
        10,
      );
      frameHeight = parseInt(
        anims[i].getElementsByTagName('FrameHeight')[0]?.textContent ?? '24',
        10,
      );
      frameCount = anims[i].getElementsByTagName('Duration').length;
      break;
    }
  }
  return { frameWidth, frameHeight, frameCount };
}

function convert(pngBuf: Buffer, xmlStr: string, name: string, outDir: string): void {
  const { frameWidth, frameHeight, frameCount } = parseAnimData(xmlStr);
  const srcPng = PNG.sync.read(pngBuf);
  const frameSize = frameWidth;
  const outW = frameCount * frameSize;
  const outH = 3 * frameSize;
  const outPng = new PNG({ width: outW, height: outH });
  outPng.data.fill(0);

  PMD_DIRS_TO_EXTRACT.forEach((pmdDir, dstRow) => {
    const srcYStart = pmdDir * PMD_ROWS_PER_DIRECTION * frameHeight;
    for (let f = 0; f < frameCount; f++) {
      for (let y = 0; y < frameSize; y++) {
        for (let x = 0; x < frameSize; x++) {
          const srcX = f * frameWidth + x;
          const srcY = srcYStart + y;
          if (srcY >= srcPng.height || srcX >= srcPng.width) continue;
          const si = (srcY * srcPng.width + srcX) * 4;
          const di = ((dstRow * frameSize + y) * outW + (f * frameSize + x)) * 4;
          outPng.data[di] = srcPng.data[si];
          outPng.data[di + 1] = srcPng.data[si + 1];
          outPng.data[di + 2] = srcPng.data[si + 2];
          outPng.data[di + 3] = srcPng.data[si + 3];
        }
      }
    }
  });

  const outPath = path.join(outDir, `${name}.png`);
  fs.writeFileSync(outPath, PNG.sync.write(outPng));
  console.log(`  ✅ ${name}.png  (${outW}×${outH}, ${frameCount} frames)`);
}

function convertDebug(pngBuf: Buffer, xmlStr: string, name: string, outDir: string): void {
  const { frameWidth, frameHeight, frameCount } = parseAnimData(xmlStr);
  const srcPng = PNG.sync.read(pngBuf);
  const frameSize = frameWidth;
  const rowW = frameCount * frameSize;
  console.log(`  ${frameWidth}x${frameHeight}px, ${frameCount} frames — writing 8 direction rows`);
  for (let d = 0; d < 8; d++) {
    const srcYStart = d * PMD_ROWS_PER_DIRECTION * frameHeight;
    const out = new PNG({ width: rowW, height: frameSize });
    out.data.fill(0);
    for (let f = 0; f < frameCount; f++) {
      for (let y = 0; y < frameSize; y++) {
        for (let x = 0; x < frameSize; x++) {
          const srcX = f * frameWidth + x;
          const srcY = srcYStart + y;
          if (srcY >= srcPng.height || srcX >= srcPng.width) continue;
          const si = (srcY * srcPng.width + srcX) * 4;
          const di = (y * rowW + f * frameSize + x) * 4;
          out.data[di] = srcPng.data[si];
          out.data[di + 1] = srcPng.data[si + 1];
          out.data[di + 2] = srcPng.data[si + 2];
          out.data[di + 3] = srcPng.data[si + 3];
        }
      }
    }
    fs.writeFileSync(path.join(outDir, `${name}_dir${d}.png`), PNG.sync.write(out));
  }
  console.log(`  ✅ wrote ${name}_dir{0..7}.png to ${outDir}`);
}

async function main(): Promise<void> {
  const debugMode = process.argv.includes('--debug');
  const outDir = path.resolve(__dirname, '..', 'webview-ui', 'public', 'assets', 'pets');
  fs.mkdirSync(outDir, { recursive: true });

  const speciesToProcess = debugMode ? SPECIES.slice(0, 1) : SPECIES;

  for (const { num, name } of speciesToProcess) {
    process.stdout.write(`Downloading ${name} (#${num})... `);
    try {
      const [pngBuf, xmlBuf] = await Promise.all([
        fetchBuffer(`${BASE_URL}/${num}/Walk-Anim.png`),
        fetchBuffer(`${BASE_URL}/${num}/AnimData.xml`),
      ]);
      process.stdout.write('converting... ');
      if (debugMode) {
        console.log('');
        convertDebug(pngBuf, xmlBuf.toString('utf-8'), name, outDir);
      } else {
        convert(pngBuf, xmlBuf.toString('utf-8'), name, outDir);
      }
    } catch (err) {
      console.log(`  ❌ ${name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log('\nDone. Rebuild to see pets in the office.');
}

main();
