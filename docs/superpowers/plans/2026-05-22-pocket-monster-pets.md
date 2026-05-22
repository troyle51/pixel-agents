# Pocket Monster Pets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3–5 ambient pocket monster pet NPCs that roam the office, randomly selected from PNG sprite assets on startup.

**Architecture:** New `Pet` entity type with a two-state FSM (IDLE/WALK) lives in `officeState.pets` alongside `characters`. Pet sprites are loaded by the extension from `assets/pets/*.png` and sent to the webview via a new `petSpritesLoaded` message, mirroring the character sprite loading pipeline. Pets are included in the existing z-sort render pass in `renderer.ts`.

**Tech Stack:** TypeScript (strict), pngjs (PNG decode), Node `test` runner + tsx/esm (webview tests), existing sprite cache (`getCachedSprite`), `findPath` BFS from `tileMap.ts`.

---

## File Map

| File                                                | Action     | Responsibility                                                  |
| --------------------------------------------------- | ---------- | --------------------------------------------------------------- |
| `shared/assets/constants.ts`                        | Modify     | Add `PET_DIRECTIONS`, `PET_FRAME_ROWS`                          |
| `shared/assets/types.ts`                            | Modify     | Add `PetDirectionSprites` type                                  |
| `shared/assets/pngDecoder.ts`                       | Modify     | Add `decodePetPng(buffer)`                                      |
| `webview-ui/src/constants.ts`                       | Modify     | Add pet behavior/animation constants                            |
| `webview-ui/src/office/types.ts`                    | Modify     | Add `PetState`, `Pet` interface                                 |
| `webview-ui/src/office/sprites/petSpriteData.ts`    | **Create** | Store and retrieve pet sprites by species+direction+frame       |
| `webview-ui/src/office/engine/pets.ts`              | **Create** | `createPet`, `updatePet` FSM                                    |
| `src/assetLoader.ts`                                | Modify     | `loadPetSprites`, `sendPetSpritesToWebview`                     |
| `src/PixelAgentsViewProvider.ts`                    | Modify     | Call pet loader in load sequence                                |
| `webview-ui/src/hooks/useExtensionMessages.ts`      | Modify     | Handle `petSpritesLoaded` message                               |
| `webview-ui/src/office/engine/officeState.ts`       | Modify     | `pets` map, `spawnPets()`, `updatePet` calls                    |
| `webview-ui/src/office/engine/renderer.ts`          | Modify     | Add `pets` param to `renderScene`+`renderFrame`, draw in z-sort |
| `webview-ui/src/office/components/OfficeCanvas.tsx` | Modify     | Pass `officeState.getPets()` to `renderFrame`                   |
| `webview-ui/public/assets/pets/`                    | **Create** | Empty directory (`.gitkeep`) for species PNGs                   |
| `scripts/convert-pmd-sprite.ts`                     | **Create** | CLI: pmdcollab ZIP → pet-format PNG                             |
| `webview-ui/test/pets.test.ts`                      | **Create** | Unit tests for decodePetPng, createPet, updatePet               |

---

## Task 1: Shared types & PNG decoder for pet sprites

**Files:**

- Modify: `shared/assets/constants.ts`
- Modify: `shared/assets/types.ts`
- Modify: `shared/assets/pngDecoder.ts`
- Create: `webview-ui/test/pets.test.ts`

- [ ] **Step 1.1: Add constants to `shared/assets/constants.ts`**

Append after the existing constants:

```ts
export const PET_FRAME_ROWS = 3; // down, up, right (left = flipped right at runtime)
export const PET_DIRECTIONS = ['down', 'up', 'right'] as const;
export type PetDirectionKey = (typeof PET_DIRECTIONS)[number];
```

- [ ] **Step 1.2: Add `PetDirectionSprites` to `shared/assets/types.ts`**

Read the file first, then append. `CharacterDirectionSprites` is already there as reference:

```ts
export interface PetDirectionSprites {
  down: SpriteData[];
  up: SpriteData[];
  right: SpriteData[];
}
```

- [ ] **Step 1.3: Add `decodePetPng` to `shared/assets/pngDecoder.ts`**

Import `PET_FRAME_ROWS` and `PET_DIRECTIONS` at the top of the file alongside existing shared/assets/constants imports. Then add after `decodeFloorPng`:

```ts
/**
 * Decode a pet sprite PNG into direction-keyed frame arrays.
 * Layout: 3 rows (down, up, right) × N square frames.
 * Frame size is inferred: frameSize = imageHeight / PET_FRAME_ROWS.
 * Frame count = imageWidth / frameSize.
 */
export function decodePetPng(pngBuffer: Buffer): PetDirectionSprites {
  const png = PNG.sync.read(pngBuffer);
  const frameSize = Math.floor(png.height / PET_FRAME_ROWS);
  const frameCount = frameSize > 0 ? Math.floor(png.width / frameSize) : 0;

  const result: PetDirectionSprites = { down: [], up: [], right: [] };

  for (let dirIdx = 0; dirIdx < PET_FRAME_ROWS; dirIdx++) {
    const dirKey = PET_DIRECTIONS[dirIdx];
    const rowOffsetY = dirIdx * frameSize;
    const frames: SpriteData[] = [];

    for (let f = 0; f < frameCount; f++) {
      const frameOffsetX = f * frameSize;
      const sprite: SpriteData = [];
      for (let y = 0; y < frameSize; y++) {
        const row: string[] = [];
        for (let x = 0; x < frameSize; x++) {
          const idx = ((rowOffsetY + y) * png.width + (frameOffsetX + x)) * 4;
          row.push(
            rgbaToHex(png.data[idx], png.data[idx + 1], png.data[idx + 2], png.data[idx + 3]),
          );
        }
        sprite.push(row);
      }
      frames.push(sprite);
    }
    result[dirKey] = frames;
  }

  return result;
}
```

Also add the import of `PetDirectionSprites` from `./types.js` at the top of pngDecoder.ts (alongside `CharacterDirectionSprites`).

- [ ] **Step 1.4: Write the failing test**

Create `webview-ui/test/pets.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PNG } from 'pngjs';
import { decodePetPng } from '../../shared/assets/pngDecoder.ts';

test('decodePetPng: extracts correct frame count and dimensions', () => {
  // 24×12 PNG: frameSize = 12/3 = 4, frameCount = 24/4 = 6
  const png = new PNG({ width: 24, height: 12 });
  png.data.fill(255); // all white, fully opaque
  const buffer = PNG.sync.write(png);

  const result = decodePetPng(buffer);

  assert.equal(result.down.length, 6, 'down should have 6 frames');
  assert.equal(result.up.length, 6, 'up should have 6 frames');
  assert.equal(result.right.length, 6, 'right should have 6 frames');
  assert.equal(result.down[0].length, 4, 'frame height should be 4');
  assert.equal(result.down[0][0].length, 4, 'frame width should be 4');
  assert.notEqual(result.down[0][0][0], '', 'opaque pixel should not be empty string');
});

test('decodePetPng: handles single-frame square PNG gracefully', () => {
  // 3×3 PNG: frameSize = 1, frameCount = 3
  const png = new PNG({ width: 3, height: 3 });
  png.data.fill(255);
  const buffer = PNG.sync.write(png);

  const result = decodePetPng(buffer);
  assert.equal(result.down.length, 3);
  assert.equal(result.down[0].length, 1); // 1 row tall
});
```

- [ ] **Step 1.5: Run test to verify it fails**

```
cd webview-ui && npm test
```

Expected: FAIL — `decodePetPng is not a function` or similar.

- [ ] **Step 1.6: Run test to verify it passes after implementing**

```
cd webview-ui && npm test
```

Expected: PASS for both `decodePetPng` tests.

- [ ] **Step 1.7: Commit**

```bash
git add shared/assets/constants.ts shared/assets/types.ts shared/assets/pngDecoder.ts webview-ui/test/pets.test.ts
git commit -m "feat: add decodePetPng for 3-row direction sprite sheets"
```

---

## Task 2: Webview types & constants

**Files:**

- Modify: `webview-ui/src/constants.ts`
- Modify: `webview-ui/src/office/types.ts`

- [ ] **Step 2.1: Add pet constants to `webview-ui/src/constants.ts`**

Append in the `Character Animation` section:

```ts
// ── Pet Animation & Behavior ─────────────────────────────────
export const PET_COUNT_MIN = 3;
export const PET_COUNT_MAX = 5;
export const PET_WANDER_PAUSE_MIN_SEC = 2.0;
export const PET_WANDER_PAUSE_MAX_SEC = 8.0;
export const PET_WALK_SPEED_PX_PER_SEC = 32;
export const PET_WALK_FRAME_DURATION_SEC = 0.15;
export const PET_APPROACH_AGENT_CHANCE = 0.3;
export const PET_APPROACH_FURNITURE_CHANCE = 0.2;
export const PET_APPROACH_RADIUS_TILES = 2;
```

- [ ] **Step 2.2: Add `PetState` and `Pet` to `webview-ui/src/office/types.ts`**

Add after the `CharacterState` block:

```ts
export const PetState = {
  IDLE: 'idle',
  WALK: 'walk',
} as const;
export type PetState = (typeof PetState)[keyof typeof PetState];

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
}
```

- [ ] **Step 2.3: Verify TypeScript compiles**

```
cd webview-ui && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2.4: Commit**

```bash
git add webview-ui/src/constants.ts webview-ui/src/office/types.ts
git commit -m "feat: add Pet type and PetState FSM constants"
```

---

## Task 3: Pet sprite data module

**Files:**

- Create: `webview-ui/src/office/sprites/petSpriteData.ts`

- [ ] **Step 3.1: Write the failing test**

In `webview-ui/test/pets.test.ts`, add:

```ts
import {
  setPetSprites,
  getPetSprites,
  getLoadedPetSpecies,
} from '../src/office/sprites/petSpriteData.ts';
import { Direction } from '../src/office/types.ts';

test('getPetSprites: returns null for unknown species', () => {
  assert.equal(getPetSprites('unknown_species'), null);
});

test('setPetSprites + getPetSprites: stores and retrieves sprite frames for all directions', () => {
  const frame: string[][] = [['#ff0000']]; // 1×1 red pixel
  setPetSprites([
    {
      speciesId: 'test_mon',
      frames: {
        down: [frame],
        up: [frame],
        right: [frame],
      },
    },
  ]);

  const sprites = getPetSprites('test_mon');
  assert.ok(sprites, 'sprites should not be null');
  assert.equal(sprites[Direction.DOWN].length, 1);
  assert.equal(sprites[Direction.UP].length, 1);
  assert.equal(sprites[Direction.RIGHT].length, 1);
  // Left should be flipped right (same content for a 1×1 pixel)
  assert.equal(sprites[Direction.LEFT].length, 1);
});

test('getLoadedPetSpecies: returns list of loaded species IDs', () => {
  const species = getLoadedPetSpecies();
  assert.ok(species.includes('test_mon'), 'should include previously loaded species');
});
```

- [ ] **Step 3.2: Run test to verify it fails**

```
cd webview-ui && npm test
```

Expected: FAIL — module not found.

- [ ] **Step 3.3: Create `webview-ui/src/office/sprites/petSpriteData.ts`**

```ts
import type { PetDirectionSprites } from '../../../../shared/assets/types.js';
import type { SpriteData } from '../types.js';
import { Direction } from '../types.js';

/** Flip a SpriteData horizontally — used to derive LEFT from RIGHT at load time */
function flipHorizontal(sprite: SpriteData): SpriteData {
  return sprite.map((row) => [...row].reverse());
}

/** All 4 directions stored for fast O(1) lookup by Direction value */
type PetSpritesByDirection = Record<Direction, SpriteData[]>;

const petSprites = new Map<string, PetSpritesByDirection>();

export interface PetSpriteInput {
  speciesId: string;
  frames: PetDirectionSprites;
}

/** Called once when petSpritesLoaded message arrives from the extension. Replaces all stored sprites. */
export function setPetSprites(data: PetSpriteInput[]): void {
  petSprites.clear();
  for (const { speciesId, frames } of data) {
    petSprites.set(speciesId, {
      [Direction.DOWN]: frames.down,
      [Direction.UP]: frames.up,
      [Direction.RIGHT]: frames.right,
      [Direction.LEFT]: frames.right.map(flipHorizontal),
    });
  }
}

/** Returns direction-indexed frames for the given species, or null if not loaded. */
export function getPetSprites(speciesId: string): PetSpritesByDirection | null {
  return petSprites.get(speciesId) ?? null;
}

/** Returns the speciesId of a specific frame, with fallback to frame 0 if index is out of range. */
export function getPetSprite(speciesId: string, dir: Direction, frame: number): SpriteData | null {
  const byDir = petSprites.get(speciesId);
  if (!byDir) return null;
  const frames = byDir[dir];
  if (!frames || frames.length === 0) return null;
  return frames[frame % frames.length];
}

/** Returns all loaded species IDs (used by spawnPets to pick randomly). */
export function getLoadedPetSpecies(): string[] {
  return Array.from(petSprites.keys());
}
```

- [ ] **Step 3.4: Run test to verify it passes**

```
cd webview-ui && npm test
```

Expected: all pet sprite data tests PASS.

- [ ] **Step 3.5: Commit**

```bash
git add webview-ui/src/office/sprites/petSpriteData.ts webview-ui/test/pets.test.ts
git commit -m "feat: add petSpriteData module with direction-indexed sprite storage"
```

---

## Task 4: Pet FSM (`createPet` + `updatePet`)

**Files:**

- Create: `webview-ui/src/office/engine/pets.ts`

- [ ] **Step 4.1: Write the failing test**

Add to `webview-ui/test/pets.test.ts`:

```ts
import { createPet, updatePet } from '../src/office/engine/pets.ts';
import { PetState, Direction } from '../src/office/types.ts';

test('createPet: initializes pet at correct tile position', () => {
  const pet = createPet(1, 'pikachu', 3, 5);
  assert.equal(pet.id, 1);
  assert.equal(pet.speciesId, 'pikachu');
  assert.equal(pet.tileCol, 3);
  assert.equal(pet.tileRow, 5);
  assert.equal(pet.state, PetState.IDLE);
  // Pixel position should be tile center
  assert.equal(pet.x, 3 * 16 + 8); // TILE_SIZE = 16
  assert.equal(pet.y, 5 * 16 + 8);
});

test('updatePet IDLE→WALK: starts walking when wanderTimer expires', () => {
  const pet = createPet(1, 'pikachu', 0, 0);
  pet.wanderTimer = 0; // expired

  const walkable = [{ col: 2, row: 2 }];
  // Simple 2×3 tileMap (all FLOOR_1 = 1)
  const tileMap = [
    [1, 1, 1],
    [1, 1, 1],
  ];
  const blocked = new Set<string>();

  updatePet(pet, 0.016, walkable, tileMap, blocked, [], []);

  assert.equal(pet.state, PetState.WALK, 'pet should transition to WALK');
  assert.ok(pet.path.length > 0, 'pet should have a path');
});

test('updatePet WALK: advances frame timer and moves along path', () => {
  const pet = createPet(1, 'pikachu', 0, 0);
  pet.state = PetState.WALK;
  pet.path = [{ col: 1, row: 0 }];
  pet.frame = 0;
  pet.frameTimer = 0;

  const tileMap = [[1, 1]];
  updatePet(pet, 0.2, [], tileMap, new Set(), [], []);

  assert.ok(pet.moveProgress > 0 || pet.tileCol === 1, 'pet should have moved');
});

test('updatePet WALK→IDLE: transitions when path is complete', () => {
  const pet = createPet(1, 'pikachu', 0, 0);
  pet.state = PetState.WALK;
  pet.path = []; // path already done
  pet.moveProgress = 1;

  updatePet(pet, 0.016, [], [[1]], new Set(), [], []);

  assert.equal(pet.state, PetState.IDLE, 'should transition to IDLE');
  assert.ok(pet.wanderTimer > 0, 'should set a new wanderTimer');
});
```

- [ ] **Step 4.2: Run test to verify it fails**

```
cd webview-ui && npm test
```

Expected: FAIL — `createPet is not a function`.

- [ ] **Step 4.3: Create `webview-ui/src/office/engine/pets.ts`**

```ts
import {
  PET_APPROACH_AGENT_CHANCE,
  PET_APPROACH_FURNITURE_CHANCE,
  PET_APPROACH_RADIUS_TILES,
  PET_WALK_FRAME_DURATION_SEC,
  PET_WALK_SPEED_PX_PER_SEC,
  PET_WANDER_PAUSE_MAX_SEC,
  PET_WANDER_PAUSE_MIN_SEC,
} from '../../constants.js';
import { findPath } from '../layout/tileMap.js';
import type {
  Character,
  FurnitureCatalogEntry,
  Pet,
  PlacedFurniture,
  TileType as TileTypeVal,
} from '../types.js';
import { Direction, PetState, TILE_SIZE } from '../types.js';

function tileCenter(col: number, row: number): { x: number; y: number } {
  return { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function directionBetween(fc: number, fr: number, tc: number, tr: number): Direction {
  if (tc > fc) return Direction.RIGHT;
  if (tc < fc) return Direction.LEFT;
  if (tr > fr) return Direction.DOWN;
  return Direction.UP;
}

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
  };
}

/** Find walkable tiles within Manhattan radius of a target tile */
function nearbyWalkable(
  targetCol: number,
  targetRow: number,
  radius: number,
  walkableTiles: Array<{ col: number; row: number }>,
): Array<{ col: number; row: number }> {
  return walkableTiles.filter(
    (t) => Math.abs(t.col - targetCol) + Math.abs(t.row - targetRow) <= radius,
  );
}

export function updatePet(
  pet: Pet,
  dt: number,
  walkableTiles: Array<{ col: number; row: number }>,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
  characters: Character[],
  furniture: PlacedFurniture[],
  getCatalog?: (type: string) => FurnitureCatalogEntry | null,
): void {
  switch (pet.state) {
    case PetState.IDLE: {
      pet.wanderTimer -= dt;
      if (pet.wanderTimer > 0) break;

      // Pick a target tile: try preferred targets in priority order, fall back to random
      let target: { col: number; row: number } | null = null;

      const roll = Math.random();

      if (roll < PET_APPROACH_AGENT_CHANCE && characters.length > 0) {
        const idleChars = characters.filter((c) => !c.isActive && !c.isSubagent);
        if (idleChars.length > 0) {
          const ch = idleChars[Math.floor(Math.random() * idleChars.length)];
          const nearby = nearbyWalkable(
            ch.tileCol,
            ch.tileRow,
            PET_APPROACH_RADIUS_TILES,
            walkableTiles,
          );
          if (nearby.length > 0) {
            target = nearby[Math.floor(Math.random() * nearby.length)];
          }
        }
      }

      if (
        !target &&
        roll < PET_APPROACH_AGENT_CHANCE + PET_APPROACH_FURNITURE_CHANCE &&
        furniture.length > 0 &&
        getCatalog
      ) {
        const activityFurniture = furniture.filter((f) => {
          const entry = getCatalog(f.type);
          return entry?.activityId != null;
        });
        if (activityFurniture.length > 0) {
          const f = activityFurniture[Math.floor(Math.random() * activityFurniture.length)];
          const nearby = nearbyWalkable(f.col, f.row, PET_APPROACH_RADIUS_TILES, walkableTiles);
          if (nearby.length > 0) {
            target = nearby[Math.floor(Math.random() * nearby.length)];
          }
        }
      }

      if (!target && walkableTiles.length > 0) {
        target = walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
      }

      if (!target) {
        pet.wanderTimer = randomRange(PET_WANDER_PAUSE_MIN_SEC, PET_WANDER_PAUSE_MAX_SEC);
        break;
      }

      const path = findPath(
        pet.tileCol,
        pet.tileRow,
        target.col,
        target.row,
        tileMap,
        blockedTiles,
      );
      if (path.length > 0) {
        pet.path = path;
        pet.moveProgress = 0;
        pet.state = PetState.WALK;
        pet.frame = 0;
        pet.frameTimer = 0;
      } else {
        // No path — just wait and try again
        pet.wanderTimer = randomRange(PET_WANDER_PAUSE_MIN_SEC, PET_WANDER_PAUSE_MAX_SEC);
      }
      break;
    }

    case PetState.WALK: {
      // Advance animation frame
      pet.frameTimer += dt;
      if (pet.frameTimer >= PET_WALK_FRAME_DURATION_SEC) {
        pet.frameTimer -= PET_WALK_FRAME_DURATION_SEC;
        pet.frame = (pet.frame + 1) % 4;
      }

      if (pet.path.length === 0) {
        // Path complete
        const center = tileCenter(pet.tileCol, pet.tileRow);
        pet.x = center.x;
        pet.y = center.y;
        pet.state = PetState.IDLE;
        pet.frame = 0;
        pet.frameTimer = 0;
        pet.wanderTimer = randomRange(PET_WANDER_PAUSE_MIN_SEC, PET_WANDER_PAUSE_MAX_SEC);
        break;
      }

      const next = pet.path[0];
      pet.dir = directionBetween(pet.tileCol, pet.tileRow, next.col, next.row);
      pet.moveProgress += (PET_WALK_SPEED_PX_PER_SEC / TILE_SIZE) * dt;

      const from = tileCenter(pet.tileCol, pet.tileRow);
      const to = tileCenter(next.col, next.row);
      const t = Math.min(pet.moveProgress, 1);
      pet.x = from.x + (to.x - from.x) * t;
      pet.y = from.y + (to.y - from.y) * t;

      if (pet.moveProgress >= 1) {
        pet.tileCol = next.col;
        pet.tileRow = next.row;
        pet.x = to.x;
        pet.y = to.y;
        pet.path.shift();
        pet.moveProgress = 0;
      }
      break;
    }
  }
}
```

- [ ] **Step 4.4: Run test to verify it passes**

```
cd webview-ui && npm test
```

Expected: all pet FSM tests PASS.

- [ ] **Step 4.5: Commit**

```bash
git add webview-ui/src/office/engine/pets.ts webview-ui/test/pets.test.ts
git commit -m "feat: add pet FSM — createPet and updatePet with IDLE/WALK states"
```

---

## Task 5: Extension asset loading for pets

**Files:**

- Modify: `src/assetLoader.ts`
- Modify: `src/PixelAgentsViewProvider.ts`
- Create: `webview-ui/public/assets/pets/.gitkeep`

- [ ] **Step 5.1: Add `LoadedPetSprites`, `loadPetSprites`, `sendPetSpritesToWebview` to `src/assetLoader.ts`**

Add these imports at the top (alongside existing pngDecoder imports):

```ts
import { decodePetPng } from '../shared/assets/pngDecoder.js';
import type { PetDirectionSprites } from '../shared/assets/types.js';
```

Then append the new functions at the bottom of `assetLoader.ts`:

```ts
// ── Pet sprite loading ───────────────────────────────────────

export interface LoadedPetSprite {
  speciesId: string;
  frames: PetDirectionSprites;
}

export interface LoadedPetSprites {
  pets: LoadedPetSprite[];
}

/**
 * Load pet sprites from assets/pets/*.png.
 * Each file is named <speciesId>.png.
 * Returns an empty array (not null) if the directory is missing — pets just won't spawn.
 */
export async function loadPetSprites(assetsRoot: string): Promise<LoadedPetSprites> {
  const petsDir = path.join(assetsRoot, 'assets', 'pets');
  const pets: LoadedPetSprite[] = [];

  if (!fs.existsSync(petsDir)) {
    console.log('[AssetLoader] No pets/ directory found — skipping pet sprites');
    return { pets };
  }

  const entries = fs.readdirSync(petsDir);
  for (const entry of entries) {
    if (!/\.png$/i.test(entry)) continue;
    const speciesId = entry.replace(/\.png$/i, '').toLowerCase();
    const filePath = path.join(petsDir, entry);
    // Path traversal guard
    const resolvedFile = path.resolve(filePath);
    const resolvedDir = path.resolve(petsDir);
    if (!resolvedFile.startsWith(resolvedDir + path.sep)) {
      console.warn(`[AssetLoader] Skipping pet with path outside directory: ${entry}`);
      continue;
    }
    try {
      const pngBuffer = fs.readFileSync(filePath);
      const frames = decodePetPng(pngBuffer);
      pets.push({ speciesId, frames });
      console.log(`[AssetLoader] Loaded pet sprite: ${speciesId}`);
    } catch (err) {
      console.warn(
        `[AssetLoader] ⚠️  Error loading pet ${entry}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  console.log(`[AssetLoader] ✅ Loaded ${pets.length} pet sprite(s)`);
  return { pets };
}

/**
 * Send pet sprites to webview.
 */
export function sendPetSpritesToWebview(
  webview: vscode.Webview,
  petSprites: LoadedPetSprites,
): void {
  webview.postMessage({
    type: 'petSpritesLoaded',
    pets: petSprites.pets,
  });
  console.log(`📤 Sent ${petSprites.pets.length} pet sprite(s) to webview`);
}
```

- [ ] **Step 5.2: Call `loadPetSprites` and `sendPetSpritesToWebview` in `src/PixelAgentsViewProvider.ts`**

Add the imports to the existing `assetLoader.ts` import block:

```ts
import type { LoadedAssets, LoadedCharacterSprites } from './assetLoader.js';
import {
  // ... existing imports ...
  loadPetSprites,
  sendPetSpritesToWebview,
} from './assetLoader.js';
```

In the asset loading sequence (after `sendAssetsToWebview` for furniture, before `sendLayout`), add:

```ts
// Load pet sprites (always send — empty array if no pets/ directory)
const petSprites = await loadPetSprites(assetsRoot);
if (this.webview) {
  sendPetSpritesToWebview(this.webview, petSprites);
}
```

Insert immediately after this block (search for the exact text `sendAssetsToWebview(this.webview, assets);`):

```ts
if (assets && this.webview) {
  console.log('[Extension] ✅ Assets loaded, sending to webview');
  sendAssetsToWebview(this.webview, assets);
}
// ↓ INSERT HERE ↓
const petSprites = await loadPetSprites(assetsRoot);
if (this.webview) {
  sendPetSpritesToWebview(this.webview, petSprites);
}
```

The `sendLayout` call comes next (already present), so pets load before layout.

- [ ] **Step 5.3: Create assets directory placeholder**

```bash
mkdir -p webview-ui/public/assets/pets
touch webview-ui/public/assets/pets/.gitkeep
```

- [ ] **Step 5.4: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5.5: Commit**

```bash
git add src/assetLoader.ts src/PixelAgentsViewProvider.ts webview-ui/public/assets/pets/.gitkeep
git commit -m "feat: load pet sprites from assets/pets/ and send petSpritesLoaded to webview"
```

---

## Task 6: Webview message handler

**Files:**

- Modify: `webview-ui/src/hooks/useExtensionMessages.ts`

- [ ] **Step 6.1: Add import in `useExtensionMessages.ts`**

At the top of the file, alongside existing sprite imports:

```ts
import { setPetSprites } from '../office/sprites/petSpriteData.js';
```

- [ ] **Step 6.2: Add `petSpritesLoaded` handler in the message event listener**

In the `handler` function inside `useEffect`, add a new `else if` branch. Search for `msg.type === 'furnitureAssetsLoaded'` — the new handler goes immediately after that block's closing brace:

```ts
} else if (msg.type === 'petSpritesLoaded') {
  setPetSprites(msg.pets as Array<{ speciesId: string; frames: { down: string[][][]; up: string[][][]; right: string[][][] } }>);
  const os = getOfficeState();
  const species = getLoadedPetSpecies();
  if (species.length > 0) {
    os.spawnPets(species);
  }
}
```

Also add `getLoadedPetSpecies` to the import from `petSpriteData.js`:

```ts
import { setPetSprites, getLoadedPetSpecies } from '../office/sprites/petSpriteData.js';
```

- [ ] **Step 6.3: Verify TypeScript compiles**

```
cd webview-ui && npx tsc --noEmit
```

Expected: `spawnPets` not yet defined on OfficeState — that's OK, it'll be fixed in Task 7.

- [ ] **Step 6.4: Commit** (after Task 7 compiles)

Defer commit to end of Task 7.

---

## Task 7: OfficeState integration

**Files:**

- Modify: `webview-ui/src/office/engine/officeState.ts`

- [ ] **Step 7.1: Add imports to `officeState.ts`**

Add at the top:

```ts
import { createPet, updatePet } from './pets.js';
import type { Pet } from '../types.js';
import { PET_COUNT_MAX, PET_COUNT_MIN } from '../../constants.js';
import { getPetSprites } from '../sprites/petSpriteData.js';
```

- [ ] **Step 7.2: Add `pets` map and `nextPetId` to `OfficeState` class**

In the class body, alongside `characters`:

```ts
pets: Map<number, Pet> = new Map();
private nextPetId = 1;
```

- [ ] **Step 7.3: Add `spawnPets` method to `OfficeState`**

Add after `findFreeSeat` (around line 236):

```ts
/**
 * Spawn 3–5 pets at random walkable tiles, using random species from loadedSpecies.
 * Called once when petSpritesLoaded arrives and sprites have been stored.
 */
spawnPets(loadedSpecies: string[]): void {
  if (loadedSpecies.length === 0 || this.walkableTiles.length === 0) return;
  this.pets.clear();
  this.nextPetId = 1;

  const count = PET_COUNT_MIN + Math.floor(Math.random() * (PET_COUNT_MAX - PET_COUNT_MIN + 1));
  // Cycle through species without replacement until we have enough
  const shuffled = [...loadedSpecies].sort(() => Math.random() - 0.5);
  for (let i = 0; i < count; i++) {
    const speciesId = shuffled[i % shuffled.length];
    // Skip species whose sprites aren't loaded (shouldn't happen but guard anyway)
    if (!getPetSprites(speciesId)) continue;
    const tile = this.walkableTiles[Math.floor(Math.random() * this.walkableTiles.length)];
    const pet = createPet(this.nextPetId++, speciesId, tile.col, tile.row);
    this.pets.set(pet.id, pet);
  }
}
```

- [ ] **Step 7.4: Call `updatePet` in the `update(dt)` method**

At the end of the `update(dt)` method (after the `characters` loop), add:

```ts
// Update pets
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
```

- [ ] **Step 7.5: Add `getPets()` accessor**

After `getCharacters()`:

```ts
getPets(): Pet[] {
  return Array.from(this.pets.values());
}
```

- [ ] **Step 7.6: Verify TypeScript compiles**

```
cd webview-ui && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7.7: Commit** (includes Task 6 change)

```bash
git add webview-ui/src/office/engine/officeState.ts webview-ui/src/hooks/useExtensionMessages.ts
git commit -m "feat: integrate pets into OfficeState — spawnPets, update loop, message handler"
```

---

## Task 8: Renderer integration

**Files:**

- Modify: `webview-ui/src/office/engine/renderer.ts`
- Modify: `webview-ui/src/office/components/OfficeCanvas.tsx`

- [ ] **Step 8.1: Add `Pet` import to `renderer.ts`**

In the existing type imports from `'../types.js'`:

```ts
import type {
  ActivitySession,
  Character,
  FurnitureInstance,
  Pet,
  Seat,
  SpriteData,
  TileType as TileTypeVal,
} from '../types.js';
```

- [ ] **Step 8.2: Add `getPetSprite` import**

```ts
import { getPetSprite } from '../sprites/petSpriteData.js';
```

- [ ] **Step 8.3: Update `renderScene` signature to include pets**

Change:

```ts
export function renderScene(
  ctx: CanvasRenderingContext2D,
  furniture: FurnitureInstance[],
  characters: Character[],
  offsetX: number,
  offsetY: number,
  zoom: number,
  selectedAgentId: number | null,
  hoveredAgentId: number | null,
  activitySessions?: Map<string, ActivitySession>,
): void {
```

To:

```ts
export function renderScene(
  ctx: CanvasRenderingContext2D,
  furniture: FurnitureInstance[],
  characters: Character[],
  offsetX: number,
  offsetY: number,
  zoom: number,
  selectedAgentId: number | null,
  hoveredAgentId: number | null,
  activitySessions?: Map<string, ActivitySession>,
  pets?: Pet[],
): void {
```

- [ ] **Step 8.4: Add pet drawables to the z-sort loop in `renderScene`**

After the characters loop (just before `drawables.sort(...)`), add:

```ts
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
```

- [ ] **Step 8.5: Update `renderFrame` signature to include pets**

Add `pets?: Pet[]` after `activitySessions`:

```ts
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  tileMap: TileTypeVal[][],
  furniture: FurnitureInstance[],
  characters: Character[],
  zoom: number,
  panX: number,
  panY: number,
  selection?: SelectionRenderState,
  editor?: EditorRenderState,
  tileColors?: Array<ColorValue | null>,
  layoutCols?: number,
  layoutRows?: number,
  activitySessions?: Map<string, ActivitySession>,
  pets?: Pet[],
): { offsetX: number; offsetY: number } {
```

- [ ] **Step 8.6: Pass `pets` through to `renderScene` inside `renderFrame`**

Find the `renderScene(ctx, allFurniture, characters, ...)` call and add `pets` as the last argument:

```ts
renderScene(
  ctx,
  allFurniture,
  characters,
  offsetX,
  offsetY,
  zoom,
  selectedId,
  hoveredId,
  activitySessions,
  pets,
);
```

- [ ] **Step 8.7: Update `OfficeCanvas.tsx` to pass pets to `renderFrame`**

In `OfficeCanvas.tsx`, the `renderFrame` call (around line 255) currently ends with `officeState.getActivitySessions()`. Add `officeState.getPets()` as the next argument:

```ts
const { offsetX, offsetY } = renderFrame(
  ctx,
  w,
  h,
  officeState.tileMap,
  officeState.furniture,
  officeState.getCharacters(),
  zoom,
  panRef.current.x,
  panRef.current.y,
  selectionRender,
  editorRender,
  officeState.getLayout().tileColors,
  officeState.getLayout().cols,
  officeState.getLayout().rows,
  officeState.getActivitySessions(),
  officeState.getPets(),
);
```

- [ ] **Step 8.8: Verify TypeScript compiles**

```
cd webview-ui && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8.9: Run all tests**

```
npm test
```

Expected: all tests PASS.

- [ ] **Step 8.10: Commit**

```bash
git add webview-ui/src/office/engine/renderer.ts webview-ui/src/office/components/OfficeCanvas.tsx
git commit -m "feat: render pets in z-sorted scene pass"
```

---

## Task 9: PMD sprite conversion script

**Files:**

- Create: `scripts/convert-pmd-sprite.ts`

The script converts a pmdcollab species ZIP to our 3-row pet PNG format.

- [ ] **Step 9.1: Create `scripts/convert-pmd-sprite.ts`**

```ts
#!/usr/bin/env npx ts-node
/**
 * Convert a pmdcollab.org species ZIP to a pixel-agents pet sprite PNG.
 *
 * Usage: npx ts-node scripts/convert-pmd-sprite.ts <path/to/species.zip> <speciesId>
 *
 * Input ZIP structure (from pmdcollab.org download):
 *   WanderingAround-Anim.png   — 8-direction walk animation sheet
 *   AnimData.xml               — frame size and count metadata
 *
 * PMD direction row order (standard pmdcollab):
 *   0=S(Down), 1=SW, 2=W, 3=NW, 4=N(Up), 5=NE, 6=E(Right), 7=SE
 *
 * Output: webview-ui/public/assets/pets/<speciesId>.png
 *   3 rows (Down, Up, Right) × N frames, each frame is frameSize×frameSize px
 */

import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { PNG } from 'pngjs';
import { DOMParser } from '@xmldom/xmldom';

const PMD_DOWN_ROW = 0;
const PMD_UP_ROW = 4;
const PMD_RIGHT_ROW = 6;
const OUTPUT_DIRECTION_ROWS = [PMD_DOWN_ROW, PMD_UP_ROW, PMD_RIGHT_ROW];

function parseAnimData(xml: string): {
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
} {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const frameWidth = parseInt(doc.getElementsByTagName('FrameWidth')[0]?.textContent ?? '24', 10);
  const frameHeight = parseInt(doc.getElementsByTagName('FrameHeight')[0]?.textContent ?? '24', 10);

  // Find WanderingAround animation to get frame count
  const anims = doc.getElementsByTagName('Anim');
  let frameCount = 4; // sensible default
  for (let i = 0; i < anims.length; i++) {
    const nameEl = anims[i].getElementsByTagName('Name')[0];
    if (nameEl?.textContent === 'WanderingAround') {
      const durations = anims[i].getElementsByTagName('Duration');
      frameCount = durations.length;
      break;
    }
  }

  return { frameWidth, frameHeight, frameCount };
}

function main(): void {
  const [, , zipPath, speciesId] = process.argv;
  if (!zipPath || !speciesId) {
    console.error('Usage: npx ts-node scripts/convert-pmd-sprite.ts <species.zip> <speciesId>');
    process.exit(1);
  }

  console.log(`Converting ${zipPath} → ${speciesId}...`);

  const zip = new AdmZip(zipPath);

  const animXmlEntry = zip.getEntries().find((e) => e.entryName.endsWith('AnimData.xml'));
  const animPngEntry = zip
    .getEntries()
    .find((e) => e.entryName.toLowerCase().endsWith('wanderingaround-anim.png'));

  if (!animXmlEntry || !animPngEntry) {
    console.error('ZIP must contain AnimData.xml and WanderingAround-Anim.png');
    process.exit(1);
  }

  const xmlContent = animXmlEntry.getData().toString('utf-8');
  const { frameWidth, frameHeight, frameCount } = parseAnimData(xmlContent);
  console.log(`Frame size: ${frameWidth}×${frameHeight}, ${frameCount} frames per direction`);

  const srcPng = PNG.sync.read(animPngEntry.getData());
  const frameSize = frameWidth; // pet PNG uses square frames

  // Output PNG: 3 rows × frameCount cols, each cell is frameSize×frameSize
  const outW = frameCount * frameSize;
  const outH = 3 * frameSize;
  const outPng = new PNG({ width: outW, height: outH });

  OUTPUT_DIRECTION_ROWS.forEach((srcRow, dstRow) => {
    for (let f = 0; f < frameCount; f++) {
      for (let y = 0; y < frameSize; y++) {
        for (let x = 0; x < frameSize; x++) {
          const srcX = f * frameWidth + x;
          const srcY = srcRow * frameHeight + y;
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

  const outDir = path.join(process.cwd(), 'webview-ui', 'public', 'assets', 'pets');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${speciesId}.png`);
  fs.writeFileSync(outPath, PNG.sync.write(outPng));

  console.log(`✅ Written to ${outPath} (${outW}×${outH})`);
}

main();
```

- [ ] **Step 9.2: Install required dependencies**

Check if `adm-zip` and `@xmldom/xmldom` are already available as dev dependencies:

```bash
grep -E 'adm-zip|xmldom' package.json
```

If missing, add to devDependencies:

```bash
npm install --save-dev adm-zip @xmldom/xmldom @types/adm-zip
```

- [ ] **Step 9.3: Test the script manually with a downloaded species ZIP**

1. Download a species ZIP from `sprites.pmdcollab.org`
2. Run: `npx ts-node scripts/convert-pmd-sprite.ts ~/Downloads/0025-Pikachu.zip pikachu`
3. Verify `webview-ui/public/assets/pets/pikachu.png` exists and has the expected 3-row layout

- [ ] **Step 9.4: Commit**

```bash
git add scripts/convert-pmd-sprite.ts package.json package-lock.json
git commit -m "feat: add convert-pmd-sprite.ts CLI for pmdcollab → pet PNG conversion"
```

---

## Task 10: Build, smoke test, and final verification

- [ ] **Step 10.1: Full build**

```bash
npm run build
```

Expected: no TypeScript or lint errors.

- [ ] **Step 10.2: Run all tests**

```bash
npm test
```

Expected: all tests PASS including new pet tests.

- [ ] **Step 10.3: Launch extension and verify pets appear**

Press F5 to open the Extension Dev Host. With at least one pet PNG in `webview-ui/public/assets/pets/`:

- Open the Pixel Agents panel
- 3–5 pets should appear on walkable tiles within a few seconds
- Pets should wander independently, occasionally moving toward idle agents or activity furniture

- [ ] **Step 10.4: Verify pet sprites render correctly**

With a real species PNG: pets should be pixel-art sized, bottom-center anchored, z-sorted correctly with furniture and agents (a pet behind a desk should be occluded).

- [ ] **Step 10.5: Verify graceful empty state**

Delete all PNGs from `assets/pets/` (or rename to confirm). Reload extension. Should start normally with 0 pets and no errors in the dev console.

- [ ] **Step 10.6: Final commit**

```bash
git add .
git commit -m "feat: pocket monster pets roam the office"
```
