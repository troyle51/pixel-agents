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

function genEntry(num: number, name: string): { num: string; name: string } {
  return { num: String(num).padStart(4, '0'), name };
}

// Gen 1 — all 151
const GEN1: Array<{ num: string; name: string }> = [
  genEntry(1, 'bulbasaur'),
  genEntry(2, 'ivysaur'),
  genEntry(3, 'venusaur'),
  genEntry(4, 'charmander'),
  genEntry(5, 'charmeleon'),
  genEntry(6, 'charizard'),
  genEntry(7, 'squirtle'),
  genEntry(8, 'wartortle'),
  genEntry(9, 'blastoise'),
  genEntry(10, 'caterpie'),
  genEntry(11, 'metapod'),
  genEntry(12, 'butterfree'),
  genEntry(13, 'weedle'),
  genEntry(14, 'kakuna'),
  genEntry(15, 'beedrill'),
  genEntry(16, 'pidgey'),
  genEntry(17, 'pidgeotto'),
  genEntry(18, 'pidgeot'),
  genEntry(19, 'rattata'),
  genEntry(20, 'raticate'),
  genEntry(21, 'spearow'),
  genEntry(22, 'fearow'),
  genEntry(23, 'ekans'),
  genEntry(24, 'arbok'),
  genEntry(25, 'pikachu'),
  genEntry(26, 'raichu'),
  genEntry(27, 'sandshrew'),
  genEntry(28, 'sandslash'),
  genEntry(29, 'nidoran-f'),
  genEntry(30, 'nidorina'),
  genEntry(31, 'nidoqueen'),
  genEntry(32, 'nidoran-m'),
  genEntry(33, 'nidorino'),
  genEntry(34, 'nidoking'),
  genEntry(35, 'clefairy'),
  genEntry(36, 'clefable'),
  genEntry(37, 'vulpix'),
  genEntry(38, 'ninetales'),
  genEntry(39, 'jigglypuff'),
  genEntry(40, 'wigglytuff'),
  genEntry(41, 'zubat'),
  genEntry(42, 'golbat'),
  genEntry(43, 'oddish'),
  genEntry(44, 'gloom'),
  genEntry(45, 'vileplume'),
  genEntry(46, 'paras'),
  genEntry(47, 'parasect'),
  genEntry(48, 'venonat'),
  genEntry(49, 'venomoth'),
  genEntry(50, 'diglett'),
  genEntry(51, 'dugtrio'),
  genEntry(52, 'meowth'),
  genEntry(53, 'persian'),
  genEntry(54, 'psyduck'),
  genEntry(55, 'golduck'),
  genEntry(56, 'mankey'),
  genEntry(57, 'primeape'),
  genEntry(58, 'growlithe'),
  genEntry(59, 'arcanine'),
  genEntry(60, 'poliwag'),
  genEntry(61, 'poliwhirl'),
  genEntry(62, 'poliwrath'),
  genEntry(63, 'abra'),
  genEntry(64, 'kadabra'),
  genEntry(65, 'alakazam'),
  genEntry(66, 'machop'),
  genEntry(67, 'machoke'),
  genEntry(68, 'machamp'),
  genEntry(69, 'bellsprout'),
  genEntry(70, 'weepinbell'),
  genEntry(71, 'victreebel'),
  genEntry(72, 'tentacool'),
  genEntry(73, 'tentacruel'),
  genEntry(74, 'geodude'),
  genEntry(75, 'graveler'),
  genEntry(76, 'golem'),
  genEntry(77, 'ponyta'),
  genEntry(78, 'rapidash'),
  genEntry(79, 'slowpoke'),
  genEntry(80, 'slowbro'),
  genEntry(81, 'magnemite'),
  genEntry(82, 'magneton'),
  genEntry(83, 'farfetchd'),
  genEntry(84, 'doduo'),
  genEntry(85, 'dodrio'),
  genEntry(86, 'seel'),
  genEntry(87, 'dewgong'),
  genEntry(88, 'grimer'),
  genEntry(89, 'muk'),
  genEntry(90, 'shellder'),
  genEntry(91, 'cloyster'),
  genEntry(92, 'gastly'),
  genEntry(93, 'haunter'),
  genEntry(94, 'gengar'),
  genEntry(95, 'onix'),
  genEntry(96, 'drowzee'),
  genEntry(97, 'hypno'),
  genEntry(98, 'krabby'),
  genEntry(99, 'kingler'),
  genEntry(100, 'voltorb'),
  genEntry(101, 'electrode'),
  genEntry(102, 'exeggcute'),
  genEntry(103, 'exeggutor'),
  genEntry(104, 'cubone'),
  genEntry(105, 'marowak'),
  genEntry(106, 'hitmonlee'),
  genEntry(107, 'hitmonchan'),
  genEntry(108, 'lickitung'),
  genEntry(109, 'koffing'),
  genEntry(110, 'weezing'),
  genEntry(111, 'rhyhorn'),
  genEntry(112, 'rhydon'),
  genEntry(113, 'chansey'),
  genEntry(114, 'tangela'),
  genEntry(115, 'kangaskhan'),
  genEntry(116, 'horsea'),
  genEntry(117, 'seadra'),
  genEntry(118, 'goldeen'),
  genEntry(119, 'seaking'),
  genEntry(120, 'staryu'),
  genEntry(121, 'starmie'),
  genEntry(122, 'mr-mime'),
  genEntry(123, 'scyther'),
  genEntry(124, 'jynx'),
  genEntry(125, 'electabuzz'),
  genEntry(126, 'magmar'),
  genEntry(127, 'pinsir'),
  genEntry(128, 'tauros'),
  genEntry(129, 'magikarp'),
  genEntry(130, 'gyarados'),
  genEntry(131, 'lapras'),
  genEntry(132, 'ditto'),
  genEntry(133, 'eevee'),
  genEntry(134, 'vaporeon'),
  genEntry(135, 'jolteon'),
  genEntry(136, 'flareon'),
  genEntry(137, 'porygon'),
  genEntry(138, 'omanyte'),
  genEntry(139, 'omastar'),
  genEntry(140, 'kabuto'),
  genEntry(141, 'kabutops'),
  genEntry(142, 'aerodactyl'),
  genEntry(143, 'snorlax'),
  genEntry(144, 'articuno'),
  genEntry(145, 'zapdos'),
  genEntry(146, 'moltres'),
  genEntry(147, 'dratini'),
  genEntry(148, 'dragonair'),
  genEntry(149, 'dragonite'),
  genEntry(150, 'mewtwo'),
  genEntry(151, 'mew'),
];

// Fan favorites from Gen 2+
const FAN_FAVORITES: Array<{ num: string; name: string }> = [
  // Gen 2
  genEntry(152, 'chikorita'),
  genEntry(155, 'cyndaquil'),
  genEntry(158, 'totodile'),
  genEntry(172, 'pichu'),
  genEntry(173, 'cleffa'),
  genEntry(174, 'igglybuff'),
  genEntry(175, 'togepi'),
  genEntry(176, 'togetic'),
  genEntry(196, 'espeon'),
  genEntry(197, 'umbreon'),
  genEntry(225, 'delibird'),
  genEntry(241, 'miltank'),
  genEntry(245, 'suicune'),
  genEntry(249, 'lugia'),
  genEntry(250, 'ho-oh'),
  genEntry(251, 'celebi'),
  // Gen 3
  genEntry(252, 'treecko'),
  genEntry(255, 'torchic'),
  genEntry(258, 'mudkip'),
  genEntry(280, 'ralts'),
  genEntry(282, 'gardevoir'),
  genEntry(302, 'sableye'),
  genEntry(303, 'mawile'),
  genEntry(333, 'swablu'),
  genEntry(334, 'altaria'),
  genEntry(359, 'absol'),
  genEntry(374, 'beldum'),
  genEntry(376, 'metagross'),
  genEntry(384, 'rayquaza'),
  genEntry(385, 'jirachi'),
  // Gen 4
  genEntry(387, 'turtwig'),
  genEntry(390, 'chimchar'),
  genEntry(393, 'piplup'),
  genEntry(403, 'shinx'),
  genEntry(405, 'luxray'),
  genEntry(442, 'spiritomb'),
  genEntry(443, 'gible'),
  genEntry(445, 'garchomp'),
  genEntry(448, 'lucario'),
  genEntry(461, 'weavile'),
  genEntry(470, 'leafeon'),
  genEntry(471, 'glaceon'),
  genEntry(475, 'gallade'),
  genEntry(478, 'froslass'),
  genEntry(479, 'rotom'),
  genEntry(483, 'dialga'),
  genEntry(484, 'palkia'),
  genEntry(487, 'giratina'),
  genEntry(491, 'darkrai'),
  genEntry(492, 'shaymin'),
  // Gen 5
  genEntry(495, 'snivy'),
  genEntry(498, 'tepig'),
  genEntry(501, 'oshawott'),
  genEntry(570, 'zorua'),
  genEntry(571, 'zoroark'),
  genEntry(572, 'minccino'),
  genEntry(643, 'reshiram'),
  genEntry(644, 'zekrom'),
  genEntry(647, 'keldeo'),
  // Gen 6
  genEntry(650, 'chespin'),
  genEntry(653, 'fennekin'),
  genEntry(656, 'froakie'),
  genEntry(677, 'espurr'),
  genEntry(678, 'meowstic'),
  genEntry(700, 'sylveon'),
  genEntry(702, 'dedenne'),
  genEntry(716, 'xerneas'),
  genEntry(717, 'yveltal'),
  genEntry(719, 'diancie'),
  // Gen 7
  genEntry(722, 'rowlet'),
  genEntry(725, 'litten'),
  genEntry(728, 'popplio'),
  genEntry(745, 'lycanroc'),
  genEntry(778, 'mimikyu'),
  genEntry(791, 'solgaleo'),
  genEntry(792, 'lunala'),
  // Gen 8
  genEntry(810, 'grookey'),
  genEntry(813, 'scorbunny'),
  genEntry(816, 'sobble'),
  genEntry(831, 'wooloo'),
  genEntry(869, 'alcremie'),
  genEntry(888, 'zacian'),
  genEntry(889, 'zamazenta'),
];

const SPECIES = [...GEN1, ...FAN_FAVORITES];

const PMD_ROWS_PER_DIRECTION = 2;
const EMOTE_ANIMS = ['Nod', 'Attack'] as const;

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function parseAnimEntry(
  xml: string,
  animName: string,
): { frameWidth: number; frameHeight: number; frameCount: number } | null {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const anims = doc.getElementsByTagName('Anim');
  for (let i = 0; i < anims.length; i++) {
    const nameEl = anims[i].getElementsByTagName('Name')[0];
    if (nameEl?.textContent === animName) {
      const frameWidth = parseInt(
        anims[i].getElementsByTagName('FrameWidth')[0]?.textContent ?? '24',
        10,
      );
      const frameHeight = parseInt(
        anims[i].getElementsByTagName('FrameHeight')[0]?.textContent ?? '24',
        10,
      );
      const frameCount = anims[i].getElementsByTagName('Duration').length;
      return { frameWidth, frameHeight, frameCount };
    }
  }
  return null;
}

// Returns [srcRowPair, flipH] for each of the 3 output rows [down, up, right].
// 8-dir sprites store S(0),SW(1),W(2),NW(3),N(4),NE(5),E(6),SE(7) → use rows 0,4,6.
// 4-dir sprites store S(0),E(1),N(2),W(3) → use rows 0,2,1 (no flip needed).
// 1-dir sprites: replicate the single row for all directions.
function getDirMap(dirCount: number): Array<[number, boolean]> {
  if (dirCount >= 8)
    return [
      [0, false],
      [4, false],
      [6, false],
    ];
  if (dirCount >= 4)
    return [
      [0, false],
      [2, false],
      [1, false],
    ];
  return [
    [0, false],
    [0, false],
    [0, false],
  ];
}

function extractDirectionRows(
  srcPng: ReturnType<typeof PNG.sync.read>,
  frameWidth: number,
  frameHeight: number,
  frameCount: number,
): PNG {
  const frameSize = frameWidth;
  const outW = frameCount * frameSize;
  const outH = 3 * frameSize;
  const outPng = new PNG({ width: outW, height: outH });
  outPng.data.fill(0);
  const bodyRows = Math.min(frameSize, frameHeight);
  const dirCount = Math.round(srcPng.height / (PMD_ROWS_PER_DIRECTION * frameHeight));
  const dirMap = getDirMap(dirCount);
  dirMap.forEach(([srcRowPair, flipH], dstRow) => {
    const srcYStart = srcRowPair * PMD_ROWS_PER_DIRECTION * frameHeight;
    for (let f = 0; f < frameCount; f++) {
      for (let y = 0; y < bodyRows; y++) {
        for (let x = 0; x < frameSize; x++) {
          const srcX = flipH ? f * frameWidth + (frameWidth - 1 - x) : f * frameWidth + x;
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
  return outPng;
}

function convert(pngBuf: Buffer, xmlStr: string, name: string, outDir: string): void {
  const entry = parseAnimEntry(xmlStr, 'Walk');
  if (!entry) {
    console.log(`  ⚠️  No Walk anim found for ${name}, skipping`);
    return;
  }
  const { frameWidth, frameHeight, frameCount } = entry;
  const srcPng = PNG.sync.read(pngBuf);
  const outPng = extractDirectionRows(srcPng, frameWidth, frameHeight, frameCount);
  const outPath = path.join(outDir, `${name}.png`);
  fs.writeFileSync(outPath, PNG.sync.write(outPng));
  console.log(`  ✅ ${name}.png  (${outPng.width}×${outPng.height}, ${frameCount} frames)`);
}

function convertAnim(
  pngBuf: Buffer,
  xmlStr: string,
  speciesName: string,
  animName: string,
  outDir: string,
): boolean {
  const entry = parseAnimEntry(xmlStr, animName);
  if (!entry) return false;
  const { frameWidth, frameHeight, frameCount } = entry;
  const srcPng = PNG.sync.read(pngBuf);
  const outPng = extractDirectionRows(srcPng, frameWidth, frameHeight, frameCount);
  const suffix = animName.toLowerCase();
  const outPath = path.join(outDir, `${speciesName}-${suffix}.png`);
  fs.writeFileSync(outPath, PNG.sync.write(outPng));
  console.log(
    `  ✅ ${speciesName}-${suffix}.png  (${outPng.width}×${outPng.height}, ${frameCount} frames)`,
  );
  return true;
}

function convertDebug(pngBuf: Buffer, xmlStr: string, name: string, outDir: string): void {
  const entry = parseAnimEntry(xmlStr, 'Walk');
  if (!entry) {
    console.log(`  ⚠️  No Walk anim found for ${name}, skipping`);
    return;
  }
  const { frameWidth, frameHeight, frameCount } = entry;
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
    const walkOutPath = path.join(outDir, `${name}.png`);
    const walkExists = fs.existsSync(walkOutPath) && !debugMode;

    if (walkExists) {
      process.stdout.write(`Skipping ${name} walk — already downloaded\n`);
    }

    // Determine which emote files are needed
    const missingEmotes = debugMode
      ? []
      : EMOTE_ANIMS.filter(
          (animName) => !fs.existsSync(path.join(outDir, `${name}-${animName.toLowerCase()}.png`)),
        );

    if (walkExists && missingEmotes.length === 0) continue;

    // Fetch Walk PNG if needed
    let walkBuf: Buffer | null = null;
    let xmlStr: string | null = null;

    try {
      if (!walkExists) {
        process.stdout.write(`Downloading ${name} (#${num})... `);
        const [pngBuf, xmlBuf] = await Promise.all([
          fetchBuffer(`${BASE_URL}/${num}/Walk-Anim.png`),
          fetchBuffer(`${BASE_URL}/${num}/AnimData.xml`),
        ]);
        walkBuf = pngBuf;
        xmlStr = xmlBuf.toString('utf-8');
        process.stdout.write('converting... ');
        if (debugMode) {
          console.log('');
          convertDebug(walkBuf, xmlStr, name, outDir);
        } else {
          convert(walkBuf, xmlStr, name, outDir);
        }
      }

      // Emote anims
      if (!debugMode && missingEmotes.length > 0) {
        if (xmlStr === null) {
          // Walk was skipped — need to fetch XML for emotes
          try {
            const xmlBuf = await fetchBuffer(`${BASE_URL}/${num}/AnimData.xml`);
            xmlStr = xmlBuf.toString('utf-8');
          } catch (err) {
            console.log(`  ❌ ${name} (XML): ${err instanceof Error ? err.message : err}`);
            continue;
          }
        }
        for (const animName of missingEmotes) {
          try {
            const animUrl = `${BASE_URL}/${num}/${animName}-Anim.png`;
            const emotePng = await fetchBuffer(animUrl);
            convertAnim(emotePng, xmlStr, name, animName, outDir);
          } catch (err) {
            if (!(err instanceof Error && err.message.startsWith('HTTP 404'))) {
              console.log(`  ⚠️  ${name} ${animName}: ${err instanceof Error ? err.message : err}`);
            }
          }
        }
      }
    } catch (err) {
      console.log(`  ❌ ${name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log('\nDone. Rebuild to see pets in the office.');
}

main();
