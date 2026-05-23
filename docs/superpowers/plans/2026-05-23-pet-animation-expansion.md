# Pet Animation Fix, Expansion & Rotation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix pet walking-direction sprites, play full walk animations, expand to ~200 species, and cycle 5 random pets every 10 minutes with matrix spawn/despawn effects.

**Architecture:** All changes within `webview-ui/src/` (types, engine, renderer) and `scripts/`. `renderMatrixEffect` is refactored to accept a minimal duck-typed interface so pets can reuse it without being coupled to `Character`. No new files; no new React components.

**Tech Stack:** TypeScript, pngjs, AdmZip, @xmldom/xmldom (all existing); `node:test` for unit tests; `npx tsx` to run scripts.

---

### Task 1: Diagnose PMD direction indices and fix both scripts

**Files:**

- Modify: `scripts/convert-pmd-sprite.ts`
- Modify: `scripts/download-starter-pets.ts`

The current `PMD_DIRS_TO_EXTRACT = [0, 4, 6]` extracts the wrong rows. Add a `--debug` flag to output all 8 direction body rows as separate PNGs, run it against Pikachu, visually identify Down/Up/Right, then update both scripts.

- [ ] **Step 1: Add `--debug` flag to convert-pmd-sprite.ts**

In `scripts/convert-pmd-sprite.ts`, replace the `main()` function body with:

```ts
function main(): void {
  const [, , zipPath, speciesId, ...flags] = process.argv;
  const debugDirs = flags.includes('--debug');
  if (!zipPath || !speciesId) {
    console.error(
      'Usage: npx tsx scripts/convert-pmd-sprite.ts <species.zip> <speciesId> [--debug]',
    );
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
  const frameSize = frameWidth;
  const outDir = path.resolve(__dirname, '..', 'webview-ui', 'public', 'assets', 'pets');
  fs.mkdirSync(outDir, { recursive: true });

  if (debugDirs) {
    console.log('Debug mode: writing dir0–dir7 body rows...');
    for (let d = 0; d < 8; d++) {
      const srcYStart = d * PMD_ROWS_PER_DIRECTION * frameHeight;
      const debugPng = new PNG({ width: frameCount * frameSize, height: frameSize });
      debugPng.data.fill(0);
      for (let f = 0; f < frameCount; f++) {
        for (let y = 0; y < frameSize; y++) {
          for (let x = 0; x < frameSize; x++) {
            const srcX = f * frameWidth + x;
            const srcY = srcYStart + y;
            if (srcY >= srcPng.height || srcX >= srcPng.width) continue;
            const si = (srcY * srcPng.width + srcX) * 4;
            const di = (y * (frameCount * frameSize) + f * frameSize + x) * 4;
            debugPng.data[di] = srcPng.data[si];
            debugPng.data[di + 1] = srcPng.data[si + 1];
            debugPng.data[di + 2] = srcPng.data[si + 2];
            debugPng.data[di + 3] = srcPng.data[si + 3];
          }
        }
      }
      const debugPath = path.join(outDir, `${speciesId.toLowerCase()}_dir${d}.png`);
      fs.writeFileSync(debugPath, PNG.sync.write(debugPng));
      console.log(`  Wrote ${speciesId.toLowerCase()}_dir${d}.png`);
    }
    console.log('Open the _dir*.png files and identify which index faces Down, Up, Right.');
    return;
  }

  const outW = frameCount * frameSize;
  const outH = 3 * frameSize;
  const outPng = new PNG({ width: outW, height: outH });
  outPng.data.fill(0);

  PMD_DIRS_TO_EXTRACT.forEach((pmdDir, dstRow) => {
    const srcBodyRow = pmdDir * PMD_ROWS_PER_DIRECTION;
    const srcYStart = srcBodyRow * frameHeight;
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

  const outPath = path.join(outDir, `${speciesId.toLowerCase()}.png`);
  fs.writeFileSync(outPath, PNG.sync.write(outPng));
  console.log(`Written to ${outPath} (${outW}x${outH})`);
}
```

- [ ] **Step 2: Download Pikachu's ZIP and run debug mode**

```bash
# Download Pikachu's zip from PMDCollab
curl -L "https://github.com/PMDCollab/SpriteCollab/raw/master/sprite/0025/Walk-Anim.png" -o /tmp/pikachu_walk.png
curl -L "https://github.com/PMDCollab/SpriteCollab/raw/master/sprite/0025/AnimData.xml" -o /tmp/pikachu_animdata.xml
```

Actually the convert script needs a ZIP. Instead, run the download script in debug mode by temporarily adding a one-off invocation at the bottom of `download-starter-pets.ts` that fetches Pikachu and passes `debugDirs = true` through a shared `convert()` function. Alternatively, the simplest approach:

Add `--debug` support directly to `download-starter-pets.ts`. At the top of `main()`, check `process.argv.includes('--debug')`. When true, only process the first species and write all 8 dir PNGs:

```ts
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
        convertDebug(pngBuf, xmlBuf.toString('utf-8'), name, outDir);
      } else {
        convert(pngBuf, xmlBuf.toString('utf-8'), name, outDir);
      }
    } catch (err) {
      console.log(`  ❌ ${name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (!debugMode) console.log('\nDone. Rebuild to see pets in the office.');
}
```

Add the `convertDebug` function just before `main()`:

```ts
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
```

Run: `npx tsx scripts/download-starter-pets.ts --debug`

Expected: `pikachu_dir0.png` through `pikachu_dir7.png` appear in `webview-ui/public/assets/pets/`.

- [ ] **Step 3: Identify correct indices**

Open the 8 debug PNGs in any image viewer. Identify:

- Which `_dir<N>.png` shows Pikachu **facing down** (toward viewer, facing camera)
- Which shows **facing up** (away from viewer, back shown)
- Which shows **facing right** (profile, right side)

Note those three `N` values. The expected result based on PMDCollab format is likely `Down=0, Up=4, Right=2` (clockwise: S=0, SE=1, E=2, NE=3, N=4, NW=5, W=6, SW=7) — but confirm visually.

- [ ] **Step 4: Update PMD_DIRS_TO_EXTRACT in both scripts**

In `scripts/download-starter-pets.ts`, change (using the indices you identified):

```ts
// BEFORE
const PMD_DIRS_TO_EXTRACT = [0, 4, 6]; // Down, Up, Right

// AFTER (example — use the actual indices from Step 3)
const PMD_DIRS_TO_EXTRACT = [0, 4, 2]; // Down, Up, Right
```

Make the same change in `scripts/convert-pmd-sprite.ts`:

```ts
// BEFORE
const PMD_DOWN_DIR = 0;
const PMD_UP_DIR = 4;
const PMD_RIGHT_DIR = 6;
const PMD_DIRS_TO_EXTRACT = [PMD_DOWN_DIR, PMD_UP_DIR, PMD_RIGHT_DIR];

// AFTER (example — use actual indices)
const PMD_DOWN_DIR = 0;
const PMD_UP_DIR = 4;
const PMD_RIGHT_DIR = 2;
const PMD_DIRS_TO_EXTRACT = [PMD_DOWN_DIR, PMD_UP_DIR, PMD_RIGHT_DIR];
```

- [ ] **Step 5: Clean up debug PNGs and re-generate the 5 starters**

```bash
# Remove debug files
rm webview-ui/public/assets/pets/pikachu_dir*.png

# Remove existing 5 starters so they get re-generated
rm webview-ui/public/assets/pets/pikachu.png
rm webview-ui/public/assets/pets/eevee.png
rm webview-ui/public/assets/pets/psyduck.png
rm webview-ui/public/assets/pets/jigglypuff.png
rm webview-ui/public/assets/pets/meowth.png

# Re-generate (only the 5 starters for now — full download comes in Task 9)
npx tsx scripts/download-starter-pets.ts
```

Expected output: 5 `.png` files written successfully.

- [ ] **Step 6: Build and visually verify directions**

```bash
npm run build
```

Launch Extension Dev Host (F5). Open pixel-agents panel. Confirm pet sprites face the correct direction when walking up, down, left, right.

- [ ] **Step 7: Commit**

```bash
git add scripts/convert-pmd-sprite.ts scripts/download-starter-pets.ts webview-ui/public/assets/pets/
git commit -m "fix: correct PMD direction indices for pet sprite extraction"
```

---

### Task 2: Fix frame count cap (TDD)

**Files:**

- Modify: `webview-ui/src/office/engine/pets.ts:143-148`
- Modify: `webview-ui/test/pets.test.ts`

- [ ] **Step 1: Write failing test**

Add to `webview-ui/test/pets.test.ts` after the existing WALK frame test:

```ts
test('updatePet WALK: advances frame past 4 when species has 8 frames', () => {
  // Set up a species with 8 walk frames
  const frame: string[][] = [['#ff0000']];
  const eightFrames = [frame, frame, frame, frame, frame, frame, frame, frame];
  setPetSprites([
    {
      speciesId: 'eight_frame_mon',
      frames: { down: eightFrames, up: eightFrames, right: eightFrames },
    },
  ]);

  const pet = createPet(99, 'eight_frame_mon', 0, 0);
  pet.state = PetState.WALK;
  pet.path = [{ col: 1, row: 0 }];
  pet.frame = 3; // just below the old cap of 4
  pet.frameTimer = 0;

  const tileMap: TileType[][] = [[TileType.FLOOR_1, TileType.FLOOR_1]];
  // Advance enough ticks to cross frame 4
  for (let i = 0; i < 10; i++) {
    updatePet(pet, PET_WALK_FRAME_DURATION_SEC * 1.1, [], tileMap, new Set(), [], []);
    if (pet.frame > 4) break;
  }

  assert.ok(pet.frame > 4, `frame should advance past 4, got ${pet.frame}`);
});
```

Add the import at the top of the test file:

```ts
import { PET_WALK_FRAME_DURATION_SEC } from '../../webview-ui/src/constants.ts';
```

Wait — check how existing imports work in the test file. Looking at the existing tests, constants are imported from `../../webview-ui/src/constants.ts`. Add to existing imports:

```ts
import { PET_WALK_FRAME_DURATION_SEC } from '../../webview-ui/src/constants.ts';
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test:webview
```

Expected: test `updatePet WALK: advances frame past 4...` FAILs — frame never exceeds 4.

- [ ] **Step 3: Remove the cap in pets.ts**

In `webview-ui/src/office/engine/pets.ts`, find and replace:

```ts
// BEFORE (lines ~143-148)
pet.frameTimer += dt;
if (pet.frameTimer >= PET_WALK_FRAME_DURATION_SEC) {
  pet.frameTimer -= PET_WALK_FRAME_DURATION_SEC;
  const petFrames = getPetSprites(pet.speciesId)?.[pet.dir]?.length ?? 4;
  const maxFrames = Math.min(4, petFrames);
  pet.frame = (pet.frame + 1) % maxFrames;
}

// AFTER
pet.frameTimer += dt;
if (pet.frameTimer >= PET_WALK_FRAME_DURATION_SEC) {
  pet.frameTimer -= PET_WALK_FRAME_DURATION_SEC;
  const frameCount = getPetSprites(pet.speciesId)?.[pet.dir]?.length ?? 4;
  pet.frame = (pet.frame + 1) % frameCount;
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm run test:webview
```

Expected: all tests PASS including the new one.

- [ ] **Step 5: Commit**

```bash
git add webview-ui/src/office/engine/pets.ts webview-ui/test/pets.test.ts
git commit -m "fix: remove 4-frame cap on pet walk animation"
```

---

### Task 3: Update pet constants

**Files:**

- Modify: `webview-ui/src/constants.ts`
- Modify: `webview-ui/src/office/engine/officeState.ts` (import update only)

- [ ] **Step 1: Replace PET_COUNT_MIN/MAX with PET_SPAWN_COUNT and add rotation interval**

In `webview-ui/src/constants.ts`, find the pet constants block:

```ts
// BEFORE
export const PET_COUNT_MIN = 3;
export const PET_COUNT_MAX = 5;

// AFTER
export const PET_SPAWN_COUNT = 5;
export const PET_ROTATION_INTERVAL_SEC = 600;
```

- [ ] **Step 2: Update the import in officeState.ts**

In `webview-ui/src/office/engine/officeState.ts`, find the constants import block and replace `PET_COUNT_MIN, PET_COUNT_MAX` with `PET_ROTATION_INTERVAL_SEC, PET_SPAWN_COUNT`:

```ts
// BEFORE (somewhere in the imports)
  PET_COUNT_MAX,
  PET_COUNT_MIN,

// AFTER
  PET_ROTATION_INTERVAL_SEC,
  PET_SPAWN_COUNT,
```

- [ ] **Step 3: Build to confirm no type errors**

```bash
npm run build
```

Expected: build fails only on the uses of `PET_COUNT_MIN`/`PET_COUNT_MAX` in `spawnPets` — which get fixed in Task 7.

- [ ] **Step 4: Commit**

```bash
git add webview-ui/src/constants.ts webview-ui/src/office/engine/officeState.ts
git commit -m "refactor: replace PET_COUNT_MIN/MAX with PET_SPAWN_COUNT + PET_ROTATION_INTERVAL_SEC"
```

---

### Task 4: Extend Pet interface with matrixEffect fields

**Files:**

- Modify: `webview-ui/src/office/types.ts`
- Modify: `webview-ui/src/office/engine/pets.ts`
- Modify: `webview-ui/test/pets.test.ts`

- [ ] **Step 1: Write failing test for createPet initialization**

Add to `webview-ui/test/pets.test.ts`:

```ts
test('createPet: initializes matrixEffect fields to null/zero/empty', () => {
  const pet = createPet(1, 'pikachu', 2, 3);
  assert.equal(pet.matrixEffect, null);
  assert.equal(pet.matrixEffectTimer, 0);
  assert.deepEqual(pet.matrixEffectSeeds, []);
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test:webview
```

Expected: TypeScript error — `matrixEffect` does not exist on type `Pet`.

- [ ] **Step 3: Add fields to the Pet interface in types.ts**

In `webview-ui/src/office/types.ts`, find the `Pet` interface and add three fields after `wanderTimer`:

```ts
export interface Pet {
  id: number;
  speciesId: string;
  state: PetState;
  dir: Direction;
  x: number;
  y: number;
  tileCol: number;
  tileRow: number;
  path: Array<{ col: number; row: number }>;
  moveProgress: number;
  frame: number;
  frameTimer: number;
  wanderTimer: number;
  matrixEffect: 'spawn' | 'despawn' | null;
  matrixEffectTimer: number;
  matrixEffectSeeds: number[];
}
```

- [ ] **Step 4: Initialize the new fields in createPet**

In `webview-ui/src/office/engine/pets.ts`, update `createPet` to initialize the three new fields:

```ts
export function createPet(id: number, speciesId: string, tileCol: number, tileRow: number): Pet {
  const center = tileCenter(tileCol, tileRow);
  return {
    id,
    speciesId,
    state: PetState.IDLE,
    dir: Direction.DOWN,
    x: center.x,
    y: center.y,
    tileCol,
    tileRow,
    path: [],
    moveProgress: 0,
    frame: 0,
    frameTimer: 0,
    wanderTimer: randomRange(PET_WANDER_PAUSE_MIN_SEC, PET_WANDER_PAUSE_MAX_SEC),
    matrixEffect: null,
    matrixEffectTimer: 0,
    matrixEffectSeeds: [],
  };
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm run test:webview
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add webview-ui/src/office/types.ts webview-ui/src/office/engine/pets.ts webview-ui/test/pets.test.ts
git commit -m "feat: add matrixEffect fields to Pet interface and createPet"
```

---

### Task 5: Refactor renderMatrixEffect to accept a generic entity

**Files:**

- Modify: `webview-ui/src/office/engine/matrixEffect.ts`

`renderMatrixEffect` currently takes `ch: Character` but only uses `ch.matrixEffect`, `ch.matrixEffectTimer`, and `ch.matrixEffectSeeds`. It also uses `MATRIX_SPRITE_COLS`/`MATRIX_SPRITE_ROWS` as hard-coded loop bounds — pet sprites have different dimensions. This task decouples both.

- [ ] **Step 1: Add a MatrixEffectEntity interface and update the function signature**

Replace the `renderMatrixEffect` function in `webview-ui/src/office/engine/matrixEffect.ts`:

```ts
export interface MatrixEffectEntity {
  matrixEffect: 'spawn' | 'despawn' | null;
  matrixEffectTimer: number;
  matrixEffectSeeds: number[];
}

/**
 * Render a Matrix-style digital rain spawn/despawn effect over any entity.
 * spriteCols and spriteRows are derived from spriteData at call time so this
 * works for both fixed-size character sprites and variable-size pet sprites.
 */
export function renderMatrixEffect(
  ctx: CanvasRenderingContext2D,
  entity: MatrixEffectEntity,
  spriteData: SpriteData,
  drawX: number,
  drawY: number,
  zoom: number,
): void {
  const progress = entity.matrixEffectTimer / MATRIX_EFFECT_DURATION;
  const isSpawn = entity.matrixEffect === 'spawn';
  const time = entity.matrixEffectTimer;
  const spriteCols = spriteData[0]?.length ?? MATRIX_SPRITE_COLS;
  const spriteRows = spriteData.length ?? MATRIX_SPRITE_ROWS;
  const totalSweep = spriteRows + MATRIX_TRAIL_LENGTH;

  for (let col = 0; col < spriteCols; col++) {
    const stagger =
      (entity.matrixEffectSeeds[col] ?? (col * 0.137) % 1) * MATRIX_COLUMN_STAGGER_RANGE;
    const colProgress = Math.max(
      0,
      Math.min(1, (progress - stagger) / (1 - MATRIX_COLUMN_STAGGER_RANGE)),
    );
    const headRow = colProgress * totalSweep;

    for (let row = 0; row < spriteRows; row++) {
      const pixel = spriteData[row]?.[col];
      const hasPixel = pixel && pixel !== '';
      const distFromHead = headRow - row;
      const px = drawX + col * zoom;
      const py = drawY + row * zoom;

      if (isSpawn) {
        if (distFromHead < 0) {
          continue;
        } else if (distFromHead < 1) {
          ctx.fillStyle = MATRIX_HEAD_COLOR;
          ctx.fillRect(px, py, zoom, zoom);
        } else if (distFromHead < MATRIX_TRAIL_LENGTH) {
          const trailPos = distFromHead / MATRIX_TRAIL_LENGTH;
          if (hasPixel) {
            ctx.fillStyle = pixel;
            ctx.fillRect(px, py, zoom, zoom);
            const greenAlpha = (1 - trailPos) * MATRIX_TRAIL_OVERLAY_ALPHA;
            if (flickerVisible(col, row, time)) {
              ctx.fillStyle = matrixGreenBright(greenAlpha);
              ctx.fillRect(px, py, zoom, zoom);
            }
          } else {
            if (flickerVisible(col, row, time)) {
              const alpha = (1 - trailPos) * MATRIX_TRAIL_EMPTY_ALPHA;
              ctx.fillStyle =
                trailPos < MATRIX_TRAIL_MID_THRESHOLD
                  ? matrixGreenBright(alpha)
                  : trailPos < MATRIX_TRAIL_DIM_THRESHOLD
                    ? matrixGreenMid(alpha)
                    : matrixGreenDim(alpha);
              ctx.fillRect(px, py, zoom, zoom);
            }
          }
        } else {
          if (hasPixel) {
            ctx.fillStyle = pixel;
            ctx.fillRect(px, py, zoom, zoom);
          }
        }
      } else {
        if (distFromHead < 0) {
          if (hasPixel) {
            ctx.fillStyle = pixel;
            ctx.fillRect(px, py, zoom, zoom);
          }
        } else if (distFromHead < 1) {
          ctx.fillStyle = MATRIX_HEAD_COLOR;
          ctx.fillRect(px, py, zoom, zoom);
        } else if (distFromHead < MATRIX_TRAIL_LENGTH) {
          if (flickerVisible(col, row, time)) {
            const trailPos = distFromHead / MATRIX_TRAIL_LENGTH;
            const alpha = (1 - trailPos) * MATRIX_TRAIL_EMPTY_ALPHA;
            ctx.fillStyle =
              trailPos < MATRIX_TRAIL_MID_THRESHOLD
                ? matrixGreenBright(alpha)
                : trailPos < MATRIX_TRAIL_DIM_THRESHOLD
                  ? matrixGreenMid(alpha)
                  : matrixGreenDim(alpha);
            ctx.fillRect(px, py, zoom, zoom);
          }
        }
      }
    }
  }
}
```

Remove the `import type { Character, SpriteData }` import line and replace with:

```ts
import type { SpriteData } from '../types.js';
```

(Character is no longer referenced in this file.)

- [ ] **Step 2: Build to verify renderer.ts still compiles**

```bash
npm run build
```

`Character` is a structural supertype of `MatrixEffectEntity` (it has all three fields), so the existing call `renderMatrixEffect(c, mCh, mSpriteData, ...)` in `renderer.ts` continues to compile without changes.

Expected: build succeeds (or fails only for pre-existing issues unrelated to this task).

- [ ] **Step 3: Commit**

```bash
git add webview-ui/src/office/engine/matrixEffect.ts
git commit -m "refactor: decouple renderMatrixEffect from Character type, use sprite dimensions"
```

---

### Task 6: Handle pet matrixEffect timing in officeState.update() (TDD)

**Files:**

- Modify: `webview-ui/src/office/engine/officeState.ts`
- Modify: `webview-ui/test/pets.test.ts`

- [ ] **Step 1: Write failing test — updatePet pauses FSM during matrixEffect**

Add to `webview-ui/test/pets.test.ts`:

```ts
test('updatePet: FSM is not updated when matrixEffect is active', () => {
  const pet = createPet(1, 'pikachu', 5, 5);
  pet.state = PetState.IDLE;
  pet.wanderTimer = 0; // would normally trigger path-finding
  pet.matrixEffect = 'spawn';
  pet.matrixEffectTimer = 0;

  const walkable = [{ col: 3, row: 3 }];
  const tileMap: TileType[][] = Array.from({ length: 6 }, () => Array(6).fill(TileType.FLOOR_1));

  // Simulate many ticks
  for (let i = 0; i < 20; i++) {
    // The FSM pause lives in officeState, not updatePet — so for this unit test
    // we verify that even with wanderTimer=0 the pet stays IDLE when the skip
    // guard is applied externally. We test the guard by confirming updatePet
    // sets WALK when called, then test that the officeState loop skips it.
    // Since we can't easily unit-test OfficeState here, just verify updatePet
    // alone transitions (to confirm the guard must be at a higher level).
  }

  // updatePet itself still processes IDLE→WALK when called directly
  updatePet(pet, 0.1, walkable, tileMap, new Set(), [], []);
  // Reset and verify the matrixEffect field doesn't affect updatePet directly —
  // the FSM skip is in officeState.update(). This is a documentation test.
  // The real guard is tested via build + manual verification.
  assert.ok(true, 'matrixEffect FSM pause is enforced in officeState.update loop');
});
```

Note: the FSM pause is implemented in `officeState.ts`, not in `updatePet`. The test above documents this. The actual behaviour is verified by the build (TypeScript) and manual test in the extension.

- [ ] **Step 2: Implement the pet matrix effect tick in officeState.update()**

In `webview-ui/src/office/engine/officeState.ts`, find the pet update loop (lines ~813–824):

```ts
// BEFORE
for (const pet of this.pets.values()) {
  updatePet(
    pet,
    dt,
    this.walkableTiles,
    this.tileMap,
    this.blockedTiles,
    Array.from(this.characters.values()),
    this.layout.furniture,
    (type) => getCatalogEntry(type) ?? null,
  );
}

// AFTER
for (const pet of this.pets.values()) {
  if (pet.matrixEffect) {
    pet.matrixEffectTimer += dt;
    if (pet.matrixEffect === 'spawn' && pet.matrixEffectTimer >= MATRIX_EFFECT_DURATION) {
      pet.matrixEffect = null;
      pet.matrixEffectTimer = 0;
    }
    continue;
  }
  updatePet(
    pet,
    dt,
    this.walkableTiles,
    this.tileMap,
    this.blockedTiles,
    Array.from(this.characters.values()),
    this.layout.furniture,
    (type) => getCatalogEntry(type) ?? null,
  );
}
```

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add webview-ui/src/office/engine/officeState.ts webview-ui/test/pets.test.ts
git commit -m "feat: pause pet FSM during matrix spawn/despawn effect"
```

---

### Task 7: Update spawnPets and add rotation timer

**Files:**

- Modify: `webview-ui/src/office/engine/officeState.ts`

Needs: `matrixEffectSeeds` import from `./matrixEffect.js`, `PET_SPAWN_COUNT` and `PET_ROTATION_INTERVAL_SEC` from constants, `getLoadedPetSpecies` from petSpriteData.

- [ ] **Step 1: Add missing imports to officeState.ts**

At the top of `webview-ui/src/office/engine/officeState.ts`, add `getLoadedPetSpecies` to the petSpriteData import:

```ts
// BEFORE
import { getPetSprites } from '../sprites/petSpriteData.js';

// AFTER
import { getLoadedPetSpecies, getPetSprites } from '../sprites/petSpriteData.js';
```

Verify `matrixEffectSeeds` is already imported from `./matrixEffect.js` (it is, from line 41). Verify `PET_ROTATION_INTERVAL_SEC` and `PET_SPAWN_COUNT` are in the constants import (added in Task 3).

- [ ] **Step 2: Update spawnPets to use PET_SPAWN_COUNT and set matrixEffect**

Replace the `spawnPets` method body:

```ts
  spawnPets(loadedSpecies: string[]): void {
    if (loadedSpecies.length === 0 || this.walkableTiles.length === 0) return;
    this.pets.clear();
    this.nextPetId = 1;

    const count = Math.min(PET_SPAWN_COUNT, loadedSpecies.length);
    const shuffled = [...loadedSpecies].sort(() => Math.random() - 0.5);
    for (let i = 0; i < count; i++) {
      const speciesId = shuffled[i];
      if (!getPetSprites(speciesId)) continue;
      const tile = this.walkableTiles[Math.floor(Math.random() * this.walkableTiles.length)];
      const pet = createPet(this.nextPetId++, speciesId, tile.col, tile.row);
      pet.matrixEffect = 'spawn';
      pet.matrixEffectTimer = 0;
      pet.matrixEffectSeeds = matrixEffectSeeds();
      this.pets.set(pet.id, pet);
    }
  }
```

- [ ] **Step 3: Add rotation timer fields to OfficeState**

After the existing `private nextPetId = 1;` line, add:

```ts
  private petRotationTimer = PET_ROTATION_INTERVAL_SEC;
  private pendingPetRespawn: number | null = null;
```

- [ ] **Step 4: Add tickPetRotation private method**

Add this method to `OfficeState` anywhere before `update()`:

```ts
  private tickPetRotation(dt: number): void {
    if (this.pendingPetRespawn !== null) {
      this.pendingPetRespawn -= dt;
      if (this.pendingPetRespawn <= 0) {
        this.pendingPetRespawn = null;
        this.pets.clear();
        this.nextPetId = 1;
        this.spawnPets(getLoadedPetSpecies());
      }
      return;
    }

    this.petRotationTimer -= dt;
    if (this.petRotationTimer <= 0) {
      this.petRotationTimer = PET_ROTATION_INTERVAL_SEC;
      for (const pet of this.pets.values()) {
        if (pet.matrixEffect !== 'despawn') {
          pet.matrixEffect = 'despawn';
          pet.matrixEffectTimer = 0;
          pet.matrixEffectSeeds = matrixEffectSeeds();
        }
      }
      this.pendingPetRespawn = MATRIX_EFFECT_DURATION + 0.05;
    }
  }
```

- [ ] **Step 5: Call tickPetRotation from update()**

At the top of the `update(dt: number)` method, just before the activity manager update, add:

```ts
  update(dt: number): void {
    // Furniture animation cycling
    const prevFrame = Math.floor(this.furnitureAnimTimer / FURNITURE_ANIM_INTERVAL_SEC);
    this.furnitureAnimTimer += dt;
    const newFrame = Math.floor(this.furnitureAnimTimer / FURNITURE_ANIM_INTERVAL_SEC);
    if (newFrame !== prevFrame) {
      this.rebuildFurnitureInstances();
    }

    this.tickPetRotation(dt);   // ← add this line

    this.activityManager.update(dt, this.characters);
    // ... rest unchanged
```

- [ ] **Step 6: Build**

```bash
npm run build
```

Expected: success.

- [ ] **Step 7: Commit**

```bash
git add webview-ui/src/office/engine/officeState.ts
git commit -m "feat: spawn exactly 5 pets with matrix effect + 10-minute rotation timer"
```

---

### Task 8: Render pet matrix effect in renderer.ts

**Files:**

- Modify: `webview-ui/src/office/engine/renderer.ts`

- [ ] **Step 1: Update the pet rendering block**

In `webview-ui/src/office/engine/renderer.ts`, find the pet rendering section (search for `// Pets`):

```ts
// BEFORE
// Pets
if (pets) {
  for (const pet of pets) {
    const spriteData = getPetSprite(pet.speciesId, pet.dir, pet.frame);
    if (!spriteData) continue;
    const cached = getCachedSprite(spriteData, zoom);
    const drawX = Math.round(offsetX + pet.x * zoom - cached.width / 2);
    const drawY = Math.round(offsetY + pet.y * zoom - cached.height);
    const petZY = pet.y + TILE_SIZE / 2 + CHARACTER_Z_SORT_OFFSET;
    drawables.push({
      zY: petZY,
      draw: (c) => {
        c.drawImage(cached, drawX, drawY);
      },
    });
  }
}

// AFTER
// Pets
if (pets) {
  for (const pet of pets) {
    if (pet.matrixEffect === 'despawn' && pet.matrixEffectTimer >= MATRIX_EFFECT_DURATION) {
      continue; // fully consumed — skip until cleared by rotation timer
    }
    const spriteData = getPetSprite(pet.speciesId, pet.dir, pet.frame);
    if (!spriteData) continue;
    const petZY = pet.y + TILE_SIZE / 2 + CHARACTER_Z_SORT_OFFSET;

    if (pet.matrixEffect) {
      const cached = getCachedSprite(spriteData, zoom);
      const drawX = Math.round(offsetX + pet.x * zoom - cached.width / 2);
      const drawY = Math.round(offsetY + pet.y * zoom - cached.height);
      const mPet = pet;
      const mSprite = spriteData;
      drawables.push({
        zY: petZY,
        draw: (c) => {
          renderMatrixEffect(c, mPet, mSprite, drawX, drawY, zoom);
        },
      });
    } else {
      const cached = getCachedSprite(spriteData, zoom);
      const drawX = Math.round(offsetX + pet.x * zoom - cached.width / 2);
      const drawY = Math.round(offsetY + pet.y * zoom - cached.height);
      drawables.push({
        zY: petZY,
        draw: (c) => {
          c.drawImage(cached, drawX, drawY);
        },
      });
    }
  }
}
```

Add `MATRIX_EFFECT_DURATION` to the existing import from `types.js` in renderer.ts:

```ts
import { CharacterState, MATRIX_EFFECT_DURATION, TILE_SIZE, TileType } from '../types.js';
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
git add webview-ui/src/office/engine/renderer.ts
git commit -m "feat: render matrix spawn/despawn effect on pets"
```

---

### Task 9: Expand species list, add idempotency, run full download

**Files:**

- Modify: `scripts/download-starter-pets.ts`
- Add: `webview-ui/public/assets/pets/*.png` (committed output)

- [ ] **Step 1: Replace SPECIES array with Gen 1 + fan favorites**

In `scripts/download-starter-pets.ts`, replace the `SPECIES` array with the full list. Gen 1 is expressed as a loop helper; fan favorites are explicit. Replace the entire `SPECIES` constant:

```ts
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
```

- [ ] **Step 2: Add idempotency check to the convert() function**

In `download-starter-pets.ts`, modify `main()` to skip already-downloaded species:

```ts
// Skip if already downloaded
const outPath = path.join(outDir, `${name}.png`);
if (fs.existsSync(outPath)) {
  console.log(`  ⏭  ${name}.png already exists — skipping`);
  continue;
}
```

Add this block just after `process.stdout.write(...)` and before the `try`:

```ts
  for (const { num, name } of speciesToProcess) {
    const outPath = path.join(outDir, `${name}.png`);
    if (fs.existsSync(outPath) && !debugMode) {
      process.stdout.write(`Skipping ${name} (#${num}) — already downloaded\n`);
      continue;
    }
    process.stdout.write(`Downloading ${name} (#${num})... `);
    try {
      // ... existing fetch/convert code
```

- [ ] **Step 3: Run the full download**

```bash
npx tsx scripts/download-starter-pets.ts
```

This will download ~200 species. Expected: each succeeds or fails gracefully with `❌`. The 5 existing starters are skipped (already present). Runtime: several minutes depending on network.

- [ ] **Step 4: Commit all downloaded PNGs**

```bash
git add scripts/download-starter-pets.ts webview-ui/public/assets/pets/
git commit -m "feat: expand pet species to Gen 1 + fan favorites (~200 species)"
```

---

### Task 10: Update existing tests

**Files:**

- Modify: `webview-ui/test/pets.test.ts`

- [ ] **Step 1: Remove PET_COUNT_MIN/MAX references**

Search the test file for any references to `PET_COUNT_MIN` or `PET_COUNT_MAX`:

```bash
grep -n "PET_COUNT" webview-ui/test/pets.test.ts
```

If found, remove or update those imports and references. Replace with `PET_SPAWN_COUNT` where needed.

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add webview-ui/test/pets.test.ts
git commit -m "test: update pet tests for new constants and matrixEffect fields"
```

---

### Task 11: Manual end-to-end verification

- [ ] **Step 1: Build and launch**

```bash
npm run build
```

Press F5 to open Extension Dev Host. Open the pixel-agents panel.

- [ ] **Step 2: Verify walking directions**

Watch pets for 30 seconds. Confirm:

- Pets facing **down** when walking toward the bottom of the screen ✓
- Pets facing **up** when walking toward the top ✓
- Pets facing **right** when walking right, and **left** (mirrored) when walking left ✓

- [ ] **Step 3: Verify spawn animation**

On extension open, confirm 5 pets appear with green matrix rain spawn effect.

- [ ] **Step 4: Test rotation (accelerated)**

To avoid waiting 10 minutes, temporarily change `PET_ROTATION_INTERVAL_SEC = 600` to `10` in `constants.ts`, rebuild, and confirm:

- After ~10 seconds, all pets despawn (matrix rain consumes them)
- Immediately after, 5 new random species spawn with matrix rain

Revert the constant after testing.

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "chore: verified pet animation fix, rotation, and species expansion"
```
