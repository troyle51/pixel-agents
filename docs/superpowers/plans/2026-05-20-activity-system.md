# Activity System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an idle activity system so characters organically seek ping pong, coffee machine, couch naps, whiteboard huddles, plant watering, and bookshelf browsing when not actively working.

**Architecture:** A new `ActivityManager` class (owned by `OfficeState`) tracks sessions keyed by furniture UID. Idle characters roll a 25% chance per wander cycle to call `activityManager.tryJoin()`. A single new `CharacterState.ACTIVITY` value is added; the manager drives per-character `frame` state. Ping pong gets a live arc-flash ball rendered in `renderer.ts`. Other activities reuse existing typing/reading frames with small canvas overlays. Character PNGs expand from 7 to 9 frames wide to add wind-up and follow-through swing frames.

**Tech Stack:** TypeScript, Canvas 2D, pngjs (PNG generation scripts), Node.js test runner via `tsx/esm` (webview unit tests)

---

## File Map

**New files:**
- `webview-ui/src/office/engine/activityManager.ts` — ActivityManager class (all activity logic)
- `webview-ui/test/activityManager.test.ts` — unit tests
- `scripts/add-swing-frames.ts` — extends char_0–5.png from 112×96 → 144×96 with swing frames
- `scripts/generate-ping-pong-table.ts` — generates PING_PONG_TABLE.png (32×16)
- `scripts/generate-coffee-machine.ts` — generates COFFEE_MACHINE.png (16×16)
- `webview-ui/public/assets/furniture/PING_PONG_TABLE/manifest.json`
- `webview-ui/public/assets/furniture/COFFEE_MACHINE/manifest.json`

**Modified files:**
- `shared/assets/constants.ts` — CHAR_FRAMES_PER_ROW: 7 → 9
- `shared/assets/types.ts` — CatalogEntry gets activityId?, activityMinPlayers?, activitySlots?
- `shared/assets/manifestUtils.ts` — FurnitureManifest and FurnitureAsset get activity fields
- `shared/assets/build.ts` — pass activity fields through buildFurnitureCatalog
- `webview-ui/src/constants.ts` — new activity constants
- `webview-ui/src/office/types.ts` — ActivitySession, ActivitySlotDef, ActivitySlotState, ACTIVITY state, activitySessionId on Character, activity fields on FurnitureCatalogEntry
- `webview-ui/src/office/sprites/spriteData.ts` — swing added to CharacterSprites; reads frames 7+8
- `webview-ui/src/office/layout/furnitureCatalog.ts` — threads activity fields through LoadedAssetData and buildDynamicCatalog
- `webview-ui/src/office/engine/officeState.ts` — owns ActivityManager, wires update/setAgentActive/getSessions
- `webview-ui/src/office/engine/characters.ts` — IDLE seek roll, ACTIVITY case, getCharacterSprite ACTIVITY branch
- `webview-ui/src/office/engine/renderer.ts` — ping pong ball pass, activity overlays, sessions param
- `webview-ui/public/assets/furniture/SOFA/manifest.json` — add activityId/slots
- `webview-ui/public/assets/furniture/WHITEBOARD/manifest.json` — add activityId/slots
- `webview-ui/public/assets/furniture/BOOKSHELF/manifest.json` — add activityId/slots
- `webview-ui/public/assets/furniture/PLANT/manifest.json` — add activityId/slots

---

## Task 1: Types and constants

**Files:**
- Modify: `webview-ui/src/constants.ts`
- Modify: `webview-ui/src/office/types.ts`

- [ ] **Step 1: Add activity constants to `webview-ui/src/constants.ts`**

Append at the end of the file (after the WHATS_NEW constants):

```ts
// ── Activity System ──────────────────────────────────────────
export const ACTIVITY_SEEK_CHANCE = 0.25;
export const BALL_SPEED = 0.6;
export const BALL_ARC_HEIGHT_PX = 12;
export const SWING_WINDUP_THRESHOLD = 0.25;
export const SWING_FOLLOWTHROUGH_THRESHOLD = 0.12;
export const WHITEBOARD_PRESENTER_ROTATE_SEC = 8;
export const COFFEE_POUR_DURATION_SEC = 3;
export const COUCH_NAP_MIN_SEC = 10;
export const COUCH_NAP_MAX_SEC = 30;
export const WATER_PLANT_DURATION_SEC = 2;
export const BOOKSHELF_BROWSE_MIN_SEC = 5;
export const BOOKSHELF_BROWSE_MAX_SEC = 15;
```

- [ ] **Step 2: Add new types to `webview-ui/src/office/types.ts`**

After the `Direction` block, add:

```ts
export interface ActivitySlotDef {
  offsetCol: number;
  offsetRow: number;
  facingDir: string;
}

export interface ActivitySlotState {
  participantId: number | null;
  arrived: boolean;
}

export interface ActivitySession {
  id: string;
  activityId: string;
  furnitureCol: number;
  furnitureRow: number;
  minPlayers: number;
  slots: ActivitySlotState[];
  phase: 'waiting' | 'active';
  timer: number;
  ballT: number;
  ballDir: 1 | -1;
  presenterIdx: number;
  presenterTimer: number;
}
```

- [ ] **Step 3: Add `ACTIVITY` to `CharacterState`**

```ts
export const CharacterState = {
  IDLE: 'idle',
  WALK: 'walk',
  TYPE: 'type',
  ACTIVITY: 'activity',
} as const;
```

- [ ] **Step 4: Add `activitySessionId` to `Character` interface**

Inside the `Character` interface, after `outputTokens`:

```ts
  activitySessionId: string | null;
```

- [ ] **Step 5: Add activity fields to `FurnitureCatalogEntry` interface**

Inside `FurnitureCatalogEntry`, after `mirrorSide?`:

```ts
  activityId?: string;
  activityMinPlayers?: number;
  activitySlots?: ActivitySlotDef[];
```

- [ ] **Step 6: Update `createCharacter` in `characters.ts` to initialize the new field**

In `webview-ui/src/office/engine/characters.ts`, in the object returned by `createCharacter()`, add:

```ts
    activitySessionId: null,
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd webview-ui && npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add webview-ui/src/constants.ts webview-ui/src/office/types.ts webview-ui/src/office/engine/characters.ts
git commit -m "feat: add activity system types and constants"
```

---

## Task 2: Thread activityId through the asset pipeline

**Files:**
- Modify: `shared/assets/types.ts`
- Modify: `shared/assets/manifestUtils.ts`
- Modify: `shared/assets/build.ts`

- [ ] **Step 1: Add activity fields to `CatalogEntry` in `shared/assets/types.ts`**

Inside the `CatalogEntry` interface, after the `frame?` field:

```ts
  activityId?: string;
  activityMinPlayers?: number;
  activitySlots?: Array<{ offsetCol: number; offsetRow: number; facingDir: string }>;
```

- [ ] **Step 2: Add activity fields to `FurnitureManifest` and `FurnitureAsset` in `shared/assets/manifestUtils.ts`**

Inside `FurnitureManifest`, after `members?`:

```ts
  activityId?: string;
  activityMinPlayers?: number;
  activitySlots?: Array<{ offsetCol: number; offsetRow: number; facingDir: string }>;
```

Inside `FurnitureAsset`, after `frame?`:

```ts
  activityId?: string;
  activityMinPlayers?: number;
  activitySlots?: Array<{ offsetCol: number; offsetRow: number; facingDir: string }>;
```

- [ ] **Step 3: Pass activity fields through `buildFurnitureCatalog` in `shared/assets/build.ts`**

In the `'asset'` branch, extend the `catalog.push()` call:

```ts
        catalog.push({
          id: manifest.id,
          name: manifest.name,
          label: manifest.name,
          category: manifest.category,
          file,
          furniturePath: `furniture/${folderName}/${file}`,
          width: manifest.width,
          height: manifest.height,
          footprintW: manifest.footprintW,
          footprintH: manifest.footprintH,
          isDesk: manifest.category === 'desks',
          canPlaceOnWalls: manifest.canPlaceOnWalls,
          canPlaceOnSurfaces: manifest.canPlaceOnSurfaces,
          backgroundTiles: manifest.backgroundTiles,
          groupId: manifest.id,
          ...(manifest.activityId ? { activityId: manifest.activityId } : {}),
          ...(manifest.activityMinPlayers !== undefined ? { activityMinPlayers: manifest.activityMinPlayers } : {}),
          ...(manifest.activitySlots ? { activitySlots: manifest.activitySlots } : {}),
        });
```

In the `'group'` branch, extend each `catalog.push()` call inside the `for (const asset of assets)` loop:

```ts
          catalog.push({
            ...asset,
            furniturePath: `furniture/${folderName}/${asset.file}`,
            ...(manifest.activityId ? { activityId: manifest.activityId } : {}),
            ...(manifest.activityMinPlayers !== undefined ? { activityMinPlayers: manifest.activityMinPlayers } : {}),
            ...(manifest.activitySlots ? { activitySlots: manifest.activitySlots } : {}),
          });
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd webview-ui && npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add shared/assets/types.ts shared/assets/manifestUtils.ts shared/assets/build.ts
git commit -m "feat: thread activityId through asset pipeline"
```

---

## Task 3: Thread activityId through furnitureCatalog.ts

**Files:**
- Modify: `webview-ui/src/office/layout/furnitureCatalog.ts`

- [ ] **Step 1: Add activity fields to `LoadedAssetData.catalog` item type**

In `furnitureCatalog.ts`, inside the `LoadedAssetData` interface, in the `catalog` array item type after `animationGroup?`:

```ts
    activityId?: string;
    activityMinPlayers?: number;
    activitySlots?: Array<{ offsetCol: number; offsetRow: number; facingDir: string }>;
```

- [ ] **Step 2: Pass activity fields in `buildDynamicCatalog`**

In the `allEntries` `.map()` callback where the catalog entry object is built (around line 88–101), add after the `mirrorSide` spread:

```ts
      ...(asset.activityId ? { activityId: asset.activityId } : {}),
      ...(asset.activityMinPlayers !== undefined ? { activityMinPlayers: asset.activityMinPlayers } : {}),
      ...(asset.activitySlots ? { activitySlots: asset.activitySlots } : {}),
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd webview-ui && npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add webview-ui/src/office/layout/furnitureCatalog.ts
git commit -m "feat: thread activityId through furnitureCatalog"
```

---

## Task 4: ActivityManager — skeleton + tests

**Files:**
- Create: `webview-ui/src/office/engine/activityManager.ts`
- Create: `webview-ui/test/activityManager.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `webview-ui/test/activityManager.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ActivityManager } from '../src/office/engine/activityManager.js';
import { CharacterState, Direction } from '../src/office/types.js';
import type { Character, FurnitureCatalogEntry, PlacedFurniture } from '../src/office/types.js';

function makeChar(id: number): Character {
  return {
    id,
    state: CharacterState.IDLE,
    dir: Direction.DOWN,
    x: 0, y: 0, tileCol: 0, tileRow: 0,
    path: [], moveProgress: 0,
    currentTool: null,
    palette: 0, hueShift: 0,
    frame: 0, frameTimer: 0,
    wanderTimer: 0, wanderCount: 0, wanderLimit: 3,
    isActive: false, seatId: null,
    bubbleType: null, bubbleTimer: 0, seatTimer: 0,
    isSubagent: false, parentAgentId: null,
    matrixEffect: null, matrixEffectTimer: 0, matrixEffectSeeds: [],
    inputTokens: 0, outputTokens: 0,
    activitySessionId: null,
  };
}

function ppFurniture(): { pf: PlacedFurniture; entry: FurnitureCatalogEntry } {
  const pf: PlacedFurniture = { uid: 'pp1', type: 'PING_PONG_TABLE', col: 5, row: 5 };
  const entry: FurnitureCatalogEntry = {
    type: 'PING_PONG_TABLE', label: 'Ping Pong Table',
    footprintW: 2, footprintH: 1, sprite: [], isDesk: false,
    activityId: 'ping_pong', activityMinPlayers: 2,
    activitySlots: [
      { offsetCol: -1, offsetRow: 0, facingDir: 'right' },
      { offsetCol: 2,  offsetRow: 0, facingDir: 'left'  },
    ],
  };
  return { pf, entry };
}

function coffeeFurniture(): { pf: PlacedFurniture; entry: FurnitureCatalogEntry } {
  const pf: PlacedFurniture = { uid: 'cf1', type: 'COFFEE_MACHINE', col: 2, row: 2 };
  const entry: FurnitureCatalogEntry = {
    type: 'COFFEE_MACHINE', label: 'Coffee Machine',
    footprintW: 1, footprintH: 1, sprite: [], isDesk: false,
    activityId: 'coffee', activityMinPlayers: 1,
    activitySlots: [{ offsetCol: 0, offsetRow: 1, facingDir: 'up' }],
  };
  return { pf, entry };
}

test('tryJoin reserves a slot and sets activitySessionId', () => {
  const mgr = new ActivityManager();
  const ch = makeChar(1);
  const { pf, entry } = ppFurniture();
  const getCatalog = (t: string) => t === 'PING_PONG_TABLE' ? entry : null;
  const chars = new Map([[1, ch]]);

  const result = mgr.tryJoin(ch, [pf], getCatalog, chars);

  assert.ok(result !== null);
  assert.equal(ch.activitySessionId, 'pp1');
  assert.equal(result.session.slots[0].participantId, 1);
  assert.equal(result.session.phase, 'waiting');
});

test('tryJoin returns null when all slots occupied', () => {
  const mgr = new ActivityManager();
  const ch1 = makeChar(1);
  const ch2 = makeChar(2);
  const ch3 = makeChar(3);
  const { pf, entry } = ppFurniture();
  const getCatalog = (t: string) => t === 'PING_PONG_TABLE' ? entry : null;
  const chars = new Map([[1, ch1], [2, ch2], [3, ch3]]);

  mgr.tryJoin(ch1, [pf], getCatalog, chars);
  mgr.tryJoin(ch2, [pf], getCatalog, chars);
  const result = mgr.tryJoin(ch3, [pf], getCatalog, chars);

  assert.equal(result, null);
  assert.equal(ch3.activitySessionId, null);
});

test('arrive flips session to active when minPlayers met', () => {
  const mgr = new ActivityManager();
  const ch1 = makeChar(1);
  const ch2 = makeChar(2);
  const { pf, entry } = ppFurniture();
  const getCatalog = (t: string) => t === 'PING_PONG_TABLE' ? entry : null;
  const chars = new Map([[1, ch1], [2, ch2]]);

  mgr.tryJoin(ch1, [pf], getCatalog, chars);
  mgr.tryJoin(ch2, [pf], getCatalog, chars);

  ch1.state = CharacterState.ACTIVITY;
  ch2.state = CharacterState.ACTIVITY;
  mgr.arrive(ch1);
  assert.equal(mgr.getSessions().get('pp1')!.phase, 'waiting');
  mgr.arrive(ch2);
  assert.equal(mgr.getSessions().get('pp1')!.phase, 'active');
});

test('arrive on solo activity immediately goes active', () => {
  const mgr = new ActivityManager();
  const ch = makeChar(1);
  const { pf, entry } = coffeeFurniture();
  const getCatalog = (t: string) => t === 'COFFEE_MACHINE' ? entry : null;
  const chars = new Map([[1, ch]]);

  mgr.tryJoin(ch, [pf], getCatalog, chars);
  ch.state = CharacterState.ACTIVITY;
  mgr.arrive(ch);

  assert.equal(mgr.getSessions().get('cf1')!.phase, 'active');
});

test('leave resets character state and evicts co-players for multi-player activity', () => {
  const mgr = new ActivityManager();
  const ch1 = makeChar(1);
  const ch2 = makeChar(2);
  const { pf, entry } = ppFurniture();
  const getCatalog = (t: string) => t === 'PING_PONG_TABLE' ? entry : null;
  const chars = new Map([[1, ch1], [2, ch2]]);

  mgr.tryJoin(ch1, [pf], getCatalog, chars);
  mgr.tryJoin(ch2, [pf], getCatalog, chars);
  ch1.state = CharacterState.ACTIVITY;
  ch2.state = CharacterState.ACTIVITY;
  mgr.arrive(ch1);
  mgr.arrive(ch2);

  mgr.leave(ch1, chars);

  assert.equal(ch1.state, CharacterState.IDLE);
  assert.equal(ch2.state, CharacterState.IDLE);
  assert.equal(ch1.activitySessionId, null);
  assert.equal(ch2.activitySessionId, null);
  assert.equal(mgr.getSessions().size, 0);
});

test('leave on solo activity removes session', () => {
  const mgr = new ActivityManager();
  const ch = makeChar(1);
  const { pf, entry } = coffeeFurniture();
  const getCatalog = (t: string) => t === 'COFFEE_MACHINE' ? entry : null;
  const chars = new Map([[1, ch]]);

  mgr.tryJoin(ch, [pf], getCatalog, chars);
  ch.state = CharacterState.ACTIVITY;
  mgr.arrive(ch);
  mgr.leave(ch, chars);

  assert.equal(ch.state, CharacterState.IDLE);
  assert.equal(mgr.getSessions().size, 0);
});
```

- [ ] **Step 2: Run tests — verify they fail with module-not-found**

```bash
cd webview-ui && npm test 2>&1 | grep -E "Error|FAIL|activityManager"
```

Expected: `Cannot find module '../src/office/engine/activityManager.js'`

- [ ] **Step 3: Create `webview-ui/src/office/engine/activityManager.ts` with skeleton**

```ts
import type {
  ActivitySession,
  ActivitySlotDef,
  Character,
  FurnitureCatalogEntry,
  PlacedFurniture,
} from '../types.js';
import { CharacterState } from '../types.js';

export class ActivityManager {
  private sessions = new Map<string, ActivitySession>();

  tryJoin(
    ch: Character,
    placedFurniture: PlacedFurniture[],
    getCatalog: (type: string) => FurnitureCatalogEntry | null,
    characters: Map<number, Character>,
  ): { session: ActivitySession; slotIndex: number; targetCol: number; targetRow: number } | null {
    const shuffled = [...placedFurniture].sort(() => Math.random() - 0.5);

    for (const pf of shuffled) {
      const entry = getCatalog(pf.type);
      if (!entry?.activityId || !entry.activitySlots?.length) continue;

      let session = this.sessions.get(pf.uid);
      if (!session) {
        session = this.createSession(pf, entry);
        this.sessions.set(pf.uid, session);
      }

      const slotIdx = session.slots.findIndex((s) => s.participantId === null);
      if (slotIdx === -1) continue;

      session.slots[slotIdx].participantId = ch.id;
      ch.activitySessionId = session.id;

      const slotDef = entry.activitySlots[slotIdx] as ActivitySlotDef;
      const targetCol = pf.col + slotDef.offsetCol;
      const targetRow = pf.row + slotDef.offsetRow;

      return { session, slotIndex: slotIdx, targetCol, targetRow };
    }

    return null;
  }

  private createSession(pf: PlacedFurniture, entry: FurnitureCatalogEntry): ActivitySession {
    return {
      id: pf.uid,
      activityId: entry.activityId!,
      furnitureCol: pf.col,
      furnitureRow: pf.row,
      minPlayers: entry.activityMinPlayers ?? 1,
      slots: (entry.activitySlots ?? []).map(() => ({ participantId: null, arrived: false })),
      phase: 'waiting',
      timer: 0,
      ballT: 0.5,
      ballDir: 1,
      presenterIdx: 0,
      presenterTimer: 0,
    };
  }

  arrive(ch: Character): void {
    if (!ch.activitySessionId) return;
    const session = this.sessions.get(ch.activitySessionId);
    if (!session) return;
    const slot = session.slots.find((s) => s.participantId === ch.id);
    if (!slot) return;
    slot.arrived = true;

    const arrivedCount = session.slots.filter((s) => s.arrived).length;
    if (arrivedCount >= session.minPlayers) {
      session.phase = 'active';
      this.initSession(session);
    }
  }

  private initSession(session: ActivitySession): void {
    // Handlers added in later tasks
    void session;
  }

  leave(ch: Character, characters: Map<number, Character>): void {
    if (!ch.activitySessionId) return;
    const sessionId = ch.activitySessionId;
    const session = this.sessions.get(sessionId);
    this.resetChar(ch);
    if (!session) return;

    const slot = session.slots.find((s) => s.participantId === ch.id);
    if (slot) { slot.participantId = null; slot.arrived = false; }

    if (session.minPlayers > 1) {
      this.endSession(sessionId, characters);
    } else if (session.slots.every((s) => s.participantId === null)) {
      this.sessions.delete(sessionId);
    } else {
      session.phase = 'waiting';
    }
  }

  private resetChar(ch: Character): void {
    ch.activitySessionId = null;
    ch.state = CharacterState.IDLE;
    ch.frame = 0;
    ch.frameTimer = 0;
  }

  private endSession(uid: string, characters: Map<number, Character>): void {
    const session = this.sessions.get(uid);
    if (!session) return;
    for (const slot of session.slots) {
      if (slot.participantId !== null) {
        const other = characters.get(slot.participantId);
        if (other) this.resetChar(other);
        slot.participantId = null;
        slot.arrived = false;
      }
    }
    this.sessions.delete(uid);
  }

  update(_dt: number, _characters: Map<number, Character>): void {
    // Handlers added in later tasks
  }

  getSessions(): Map<string, ActivitySession> {
    return this.sessions;
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd webview-ui && npm test 2>&1 | grep -E "pass|fail|ok|not ok"
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add webview-ui/src/office/engine/activityManager.ts webview-ui/test/activityManager.test.ts
git commit -m "feat: ActivityManager skeleton with tryJoin/arrive/leave"
```

---

## Task 5: ActivityManager — ping_pong update handler

**Files:**
- Modify: `webview-ui/src/office/engine/activityManager.ts`
- Modify: `webview-ui/test/activityManager.test.ts`

- [ ] **Step 1: Write failing tests for ping_pong ball physics**

Append to `webview-ui/test/activityManager.test.ts`:

```ts
test('ping_pong: ballT advances and bounces between 0 and 1', () => {
  const mgr = new ActivityManager();
  const ch1 = makeChar(1);
  const ch2 = makeChar(2);
  const { pf, entry } = ppFurniture();
  const getCatalog = (t: string) => t === 'PING_PONG_TABLE' ? entry : null;
  const chars = new Map([[1, ch1], [2, ch2]]);

  mgr.tryJoin(ch1, [pf], getCatalog, chars);
  mgr.tryJoin(ch2, [pf], getCatalog, chars);
  ch1.state = CharacterState.ACTIVITY;
  ch2.state = CharacterState.ACTIVITY;
  mgr.arrive(ch1);
  mgr.arrive(ch2);

  const session = mgr.getSessions().get('pp1')!;
  assert.equal(session.ballDir, 1);

  // Advance until ball reaches right end
  for (let i = 0; i < 200; i++) mgr.update(0.05, chars);
  assert.ok(session.ballT >= 0 && session.ballT <= 1, `ballT out of range: ${session.ballT}`);
  // Ball should have bounced — direction flips
  assert.equal(session.ballDir, -1);
});

test('ping_pong: left player gets swing frame when ball near their end', () => {
  const mgr = new ActivityManager();
  const ch1 = makeChar(1);
  const ch2 = makeChar(2);
  const { pf, entry } = ppFurniture();
  const getCatalog = (t: string) => t === 'PING_PONG_TABLE' ? entry : null;
  const chars = new Map([[1, ch1], [2, ch2]]);

  mgr.tryJoin(ch1, [pf], getCatalog, chars);
  mgr.tryJoin(ch2, [pf], getCatalog, chars);
  ch1.state = CharacterState.ACTIVITY;
  ch2.state = CharacterState.ACTIVITY;
  mgr.arrive(ch1);
  mgr.arrive(ch2);

  // Force ball to left end
  const session = mgr.getSessions().get('pp1')!;
  session.ballT = 0.05; // within SWING_FOLLOWTHROUGH_THRESHOLD (0.12) of left end (ballT=0)
  mgr.update(0.001, chars);

  assert.equal(ch1.frame, 2); // follow-through
});
```

- [ ] **Step 2: Run tests — verify the new tests fail**

```bash
cd webview-ui && npm test 2>&1 | grep -E "pass|fail|ok|not ok"
```

Expected: the 2 new tests fail (ballDir doesn't flip, frame stays 0).

- [ ] **Step 3: Import constants and implement ping_pong in `activityManager.ts`**

Add imports at the top of `activityManager.ts`:

```ts
import {
  BALL_SPEED,
  BOOKSHELF_BROWSE_MAX_SEC,
  BOOKSHELF_BROWSE_MIN_SEC,
  COFFEE_POUR_DURATION_SEC,
  COUCH_NAP_MAX_SEC,
  COUCH_NAP_MIN_SEC,
  SWING_FOLLOWTHROUGH_THRESHOLD,
  SWING_WINDUP_THRESHOLD,
  WATER_PLANT_DURATION_SEC,
  WHITEBOARD_PRESENTER_ROTATE_SEC,
} from '../../constants.js';
```

Replace `private initSession(session: ActivitySession): void` with:

```ts
  private initSession(session: ActivitySession): void {
    switch (session.activityId) {
      case 'ping_pong':
        session.ballT = 0.5;
        session.ballDir = 1;
        break;
      case 'coffee':
        session.timer = COFFEE_POUR_DURATION_SEC;
        break;
      case 'couch':
        session.timer = COUCH_NAP_MIN_SEC + Math.random() * (COUCH_NAP_MAX_SEC - COUCH_NAP_MIN_SEC);
        break;
      case 'water_plant':
        session.timer = WATER_PLANT_DURATION_SEC;
        break;
      case 'bookshelf':
        session.timer = BOOKSHELF_BROWSE_MIN_SEC + Math.random() * (BOOKSHELF_BROWSE_MAX_SEC - BOOKSHELF_BROWSE_MIN_SEC);
        break;
      case 'whiteboard':
        session.presenterIdx = 0;
        session.presenterTimer = WHITEBOARD_PRESENTER_ROTATE_SEC;
        break;
    }
  }
```

Replace `update(_dt: number, _characters: Map<number, Character>): void` with:

```ts
  update(dt: number, characters: Map<number, Character>): void {
    for (const [uid, session] of this.sessions) {
      if (session.phase !== 'active') continue;
      switch (session.activityId) {
        case 'ping_pong':
          this.tickPingPong(session, dt, characters);
          break;
        case 'coffee':
        case 'water_plant':
        case 'couch':
        case 'bookshelf':
          session.timer -= dt;
          if (session.timer <= 0) this.endSession(uid, characters);
          break;
        case 'whiteboard':
          this.tickWhiteboard(session, dt, characters);
          break;
      }
    }
  }

  private tickPingPong(
    session: ActivitySession,
    dt: number,
    characters: Map<number, Character>,
  ): void {
    session.ballT += session.ballDir * BALL_SPEED * dt;
    if (session.ballT >= 1) { session.ballT = 1; session.ballDir = -1; }
    if (session.ballT <= 0) { session.ballT = 0; session.ballDir = 1; }

    // slot 0 = left player (ballT=0 is their end), slot 1 = right player (ballT=1 is their end)
    for (let i = 0; i < session.slots.length; i++) {
      const slot = session.slots[i];
      if (!slot.arrived || slot.participantId === null) continue;
      const ch = characters.get(slot.participantId);
      if (!ch) continue;
      const proximity = i === 0 ? session.ballT : 1 - session.ballT;
      if (proximity <= SWING_FOLLOWTHROUGH_THRESHOLD) {
        ch.frame = 2;
      } else if (proximity <= SWING_WINDUP_THRESHOLD) {
        ch.frame = 1;
      } else {
        ch.frame = 0;
      }
    }
  }

  private tickWhiteboard(
    session: ActivitySession,
    dt: number,
    characters: Map<number, Character>,
  ): void {
    session.presenterTimer -= dt;
    if (session.presenterTimer <= 0) {
      session.presenterTimer = WHITEBOARD_PRESENTER_ROTATE_SEC;
      const active = session.slots
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.arrived && s.participantId !== null);
      if (active.length > 0) {
        const cur = active.findIndex(({ i }) => i === session.presenterIdx);
        session.presenterIdx = active[(cur + 1) % active.length].i;
      }
    }
    for (let i = 0; i < session.slots.length; i++) {
      const slot = session.slots[i];
      if (!slot.arrived || slot.participantId === null) continue;
      const ch = characters.get(slot.participantId);
      if (!ch) continue;
      ch.frame = i === session.presenterIdx ? 0 : 1;
    }
  }
```

- [ ] **Step 4: Run all tests — verify they pass**

```bash
cd webview-ui && npm test
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add webview-ui/src/office/engine/activityManager.ts webview-ui/test/activityManager.test.ts
git commit -m "feat: ActivityManager ping_pong ball physics and whiteboard rotation"
```

---

## Task 6: Wire OfficeState

**Files:**
- Modify: `webview-ui/src/office/engine/officeState.ts`

- [ ] **Step 1: Import ActivityManager and add it to OfficeState**

In `officeState.ts`, add import:

```ts
import { ActivityManager } from './activityManager.js';
```

Add `activityManager` property to the class after `nextSubagentId`:

```ts
  readonly activityManager = new ActivityManager();
```

- [ ] **Step 2: Call `activityManager.update()` in the `update()` method**

In the `update(dt: number)` method, before the `const toDelete` line:

```ts
    this.activityManager.update(dt, this.characters);
```

- [ ] **Step 3: Call `activityManager.leave()` in `setAgentActive`**

In `setAgentActive(id: number, active: boolean)`, at the start of the `if (ch)` block before `ch.isActive = active`:

```ts
      if (active && ch.activitySessionId) {
        this.activityManager.leave(ch, this.characters);
      }
```

- [ ] **Step 4: Expose sessions for the renderer**

Add a getter method after `getCharacters()`:

```ts
  getActivitySessions(): Map<string, ActivitySession> {
    return this.activityManager.getSessions();
  }
```

Also add the import for `ActivitySession` at the top if not already present.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd webview-ui && npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add webview-ui/src/office/engine/officeState.ts
git commit -m "feat: wire ActivityManager into OfficeState"
```

---

## Task 7: Wire characters.ts — IDLE seek and ACTIVITY state

**Files:**
- Modify: `webview-ui/src/office/engine/characters.ts`

- [ ] **Step 1: Update `updateCharacter` signature to accept ActivityManager and furniture**

Change the function signature to:

```ts
export function updateCharacter(
  ch: Character,
  dt: number,
  walkableTiles: Array<{ col: number; row: number }>,
  seats: Map<string, Seat>,
  tileMap: TileTypeVal[][],
  blockedTiles: Set<string>,
  activityManager?: {
    tryJoin: (
      ch: Character,
      furniture: PlacedFurniture[],
      getCatalog: (type: string) => FurnitureCatalogEntry | null,
      characters: Map<number, Character>,
    ) => { session: ActivitySession; slotIndex: number; targetCol: number; targetRow: number } | null;
    arrive: (ch: Character) => void;
  },
  placedFurniture?: PlacedFurniture[],
  getCatalog?: (type: string) => FurnitureCatalogEntry | null,
  characters?: Map<number, Character>,
): void {
```

Add imports at the top:

```ts
import { ACTIVITY_SEEK_CHANCE } from '../../constants.js';
import type { ActivitySession, FurnitureCatalogEntry, PlacedFurniture } from '../types.js';
import { CharacterState, Direction } from '../types.js';
```

- [ ] **Step 2: Add ACTIVITY case to the switch**

After the `WALK` case closing brace, add:

```ts
    case CharacterState.ACTIVITY: {
      ch.frameTimer += dt;
      // ActivityManager drives ch.frame directly; nothing to do here.
      break;
    }
```

- [ ] **Step 3: Add activity seek in the IDLE case**

In the `IDLE` case, just before `ch.wanderTimer -= dt;`, add:

```ts
      // Chance to seek an activity instead of wandering
      if (
        ch.wanderTimer <= 0 &&
        !ch.activitySessionId &&
        activityManager &&
        placedFurniture &&
        getCatalog &&
        characters &&
        Math.random() < ACTIVITY_SEEK_CHANCE
      ) {
        const result = activityManager.tryJoin(ch, placedFurniture, getCatalog, characters);
        if (result) {
          const path = findPath(
            ch.tileCol, ch.tileRow,
            result.targetCol, result.targetRow,
            tileMap, blockedTiles,
          );
          if (path.length > 0) {
            ch.path = path;
            ch.moveProgress = 0;
            ch.state = CharacterState.WALK;
            ch.frame = 0;
            ch.frameTimer = 0;
            ch.wanderTimer = 0;
            break;
          } else {
            // Can't path there — undo reservation
            result.session.slots.find(s => s.participantId === ch.id)!.participantId = null;
            ch.activitySessionId = null;
          }
        }
      }
```

- [ ] **Step 4: Call `activityManager.arrive()` when walking character reaches their activity slot**

In the `WALK` case, in the block that runs when `ch.path.length === 0` (path complete), before the `if (ch.isActive)` check, add:

```ts
        // Arrived at activity slot
        if (ch.activitySessionId && activityManager) {
          ch.state = CharacterState.ACTIVITY;
          ch.frame = 0;
          ch.frameTimer = 0;
          activityManager.arrive(ch);
          break;
        }
```

- [ ] **Step 5: Update `getCharacterSprite` to handle ACTIVITY state**

In `getCharacterSprite`, add an `ACTIVITY` case:

```ts
    case CharacterState.ACTIVITY:
      // frame 0 = standing, 1 = swing wind-up, 2 = swing follow-through
      // Only ping_pong uses swing; others use standing or typing poses
      if (ch.frame === 1) return sprites.swing[ch.dir][0];
      if (ch.frame === 2) return sprites.swing[ch.dir][1];
      return sprites.walk[ch.dir][1];
```

- [ ] **Step 6: Update call site in `officeState.ts` to pass new params**

In `officeState.ts`, in the `update()` method where `updateCharacter` is called (inside `withOwnSeatUnblocked`), update to:

```ts
        this.withOwnSeatUnblocked(ch, () =>
          updateCharacter(
            ch, dt, this.walkableTiles, this.seats, this.tileMap, this.blockedTiles,
            this.activityManager,
            this.layout.furniture,
            getCatalogEntry,
            this.characters,
          ),
        );
```

Import `getCatalogEntry` if not already imported:

```ts
import { getCatalogEntry } from '../layout/furnitureCatalog.js';
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd webview-ui && npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 8: Run all tests**

```bash
cd webview-ui && npm test
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add webview-ui/src/office/engine/characters.ts webview-ui/src/office/engine/officeState.ts
git commit -m "feat: idle activity seek and ACTIVITY FSM state"
```

---

## Task 8: Swing frames — decoder constant + CharacterSprites

**Files:**
- Modify: `shared/assets/constants.ts`
- Modify: `webview-ui/src/office/sprites/spriteData.ts`

- [ ] **Step 1: Bump `CHAR_FRAMES_PER_ROW` from 7 to 9**

In `shared/assets/constants.ts`:

```ts
export const CHAR_FRAMES_PER_ROW = 9;
```

- [ ] **Step 2: Add `swing` to `CharacterSprites` interface in `spriteData.ts`**

```ts
export interface CharacterSprites {
  walk: Record<Direction, [SpriteData, SpriteData, SpriteData, SpriteData]>;
  typing: Record<Direction, [SpriteData, SpriteData]>;
  reading: Record<Direction, [SpriteData, SpriteData]>;
  swing: Record<Direction, [SpriteData, SpriteData]>;
}
```

- [ ] **Step 3: Add swing to `hueShiftSprites`**

Inside `hueShiftSprites`, after the `reading` block:

```ts
    swing: {
      [Dir.DOWN]: shiftPair(sprites.swing[Dir.DOWN]),
      [Dir.UP]: shiftPair(sprites.swing[Dir.UP]),
      [Dir.RIGHT]: shiftPair(sprites.swing[Dir.RIGHT]),
      [Dir.LEFT]: shiftPair(sprites.swing[Dir.LEFT]),
    } as Record<Direction, [SpriteData, SpriteData]>,
```

- [ ] **Step 4: Read frames 7 and 8 in `getCharacterSprites` (loaded branch)**

Inside the `if (loadedCharacters)` branch, after the `reading` block:

```ts
      swing: {
        [Dir.DOWN]: [d[7], d[8]],
        [Dir.UP]: [u[7], u[8]],
        [Dir.RIGHT]: [rt[7], rt[8]],
        [Dir.LEFT]: [flip(rt[7]), flip(rt[8])],
      },
```

- [ ] **Step 5: Add swing to the fallback (no PNGs loaded) branch**

In the `else` branch at the bottom:

```ts
      swing: {
        [Dir.DOWN]: pairSet,
        [Dir.UP]: pairSet,
        [Dir.RIGHT]: pairSet,
        [Dir.LEFT]: pairSet,
      },
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd webview-ui && npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add shared/assets/constants.ts webview-ui/src/office/sprites/spriteData.ts
git commit -m "feat: add swing frames to CharacterSprites, bump CHAR_FRAMES_PER_ROW to 9"
```

---

## Task 9: Generate swing frame PNGs

**Files:**
- Create: `scripts/add-swing-frames.ts`
- Output: updated `webview-ui/public/assets/characters/char_0.png` through `char_5.png`

- [ ] **Step 1: Create `scripts/add-swing-frames.ts`**

This script reads each 112×96 character PNG, appends 2 new 16×32 frames per direction row (swing wind-up and follow-through) and saves a 144×96 PNG. It samples key pixel colors from the existing typing frame (right-direction, frame index 3) at known positions.

```ts
#!/usr/bin/env node
/**
 * Extends character sprite sheets from 112×96 (7 frames) to 144×96 (9 frames)
 * by appending wind-up (swing1) and follow-through (swing2) frames.
 * Run: npx tsx scripts/add-swing-frames.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHARS_DIR = path.resolve(__dirname, '../webview-ui/public/assets/characters');

const W_OLD = 112, W_NEW = 144, H = 96;
const FW = 16, FH = 32;
// Direction row offsets in pixels
const ROWS = { down: 0, up: FH, right: FH * 2 };

// Sample a pixel from the source PNG (returns [r,g,b,a])
function samplePixel(data: Buffer, width: number, px: number, py: number): [number,number,number,number] {
  const i = (py * width + px) * 4;
  return [data[i], data[i+1], data[i+2], data[i+3]];
}

// Write a pixel into dest PNG data
function writePixel(data: Buffer, width: number, px: number, py: number, rgba: [number,number,number,number]): void {
  const i = (py * width + px) * 4;
  [data[i], data[i+1], data[i+2], data[i+3]] = rgba;
}

function toRgba(r: number, g: number, b: number, a = 255): [number,number,number,number] {
  return [r, g, b, a];
}

const TRANSPARENT: [number,number,number,number] = [0, 0, 0, 0];

// Swing frame pixel definitions.
// Each entry: [localX, localY, colorKey]
// colorKey: 'skin'|'hair'|'body'|'leg'|'shoe'|'paddle_handle'|'paddle_face'
type ColorKey = 'skin' | 'hair' | 'body' | 'leg' | 'shoe' | 'paddle_handle' | 'paddle_face';

const SWING1_PIXELS: Array<[number, number, ColorKey]> = [
  // Shoes (rows 29-31)
  ...[29,30,31].flatMap(y => [4,5,6,7,8].map(x => [x, y, 'shoe'] as [number,number,ColorKey])),
  // Legs (rows 23-28)
  ...[23,24,25,26,27,28].flatMap(y => [[4,y,'leg'],[5,y,'leg'],[7,y,'leg'],[8,y,'leg']] as Array<[number,number,ColorKey]>),
  // Body leaning back (rows 14-22)
  ...[14,15,16,17,18,19,20,21,22].flatMap(y =>
    [3,4,5,6,7,8].map(x => [x, y, 'body'] as [number,number,ColorKey])),
  // Arm pulled back (rows 16-18, col 2)
  [2,16,'skin'],[2,17,'skin'],[2,18,'skin'],
  // Paddle handle (rows 16-17, cols 0-1)
  [1,16,'paddle_handle'],[1,17,'paddle_handle'],[0,17,'paddle_handle'],
  // Paddle face (rows 14-16)
  [0,14,'paddle_face'],[0,15,'paddle_face'],[0,16,'paddle_face'],[1,14,'paddle_face'],[1,15,'paddle_face'],
  // Head (rows 8-14)
  ...[8,9,10,11,12,13,14].flatMap(y => [4,5,6,7].map(x => [x,y,'skin'] as [number,number,ColorKey])),
  // Hair (rows 8-9)
  ...[8,9].flatMap(y => [4,5,6,7].map(x => [x,y,'hair'] as [number,number,ColorKey])),
];

const SWING2_PIXELS: Array<[number, number, ColorKey]> = [
  // Shoes wider apart (rows 29-31)
  ...[29,30,31].flatMap(y => [6,7,8,9,10,11].map(x => [x, y, 'shoe'] as [number,number,ColorKey])),
  // Legs (rows 23-28) wider
  ...[23,24,25,26,27,28].flatMap(y => [[6,y,'leg'],[7,y,'leg'],[10,y,'leg'],[11,y,'leg']] as Array<[number,number,ColorKey]>),
  // Body lunging forward (rows 14-22)
  ...[14,15,16,17,18,19,20,21,22].flatMap(y =>
    [7,8,9,10,11,12,13].map(x => [x, y, 'body'] as [number,number,ColorKey])),
  // Arm extended (rows 15-17, cols 14-15)
  [14,15,'skin'],[15,15,'skin'],[14,16,'skin'],[15,16,'skin'],
  // Paddle handle
  [14,16,'paddle_handle'],[15,16,'paddle_handle'],
  // Paddle face extended (rows 12-16, cols 13-15)
  ...[12,13,14,15,16].flatMap(y => [14,15].map(x => [x,y,'paddle_face'] as [number,number,ColorKey])),
  [13,12,'paddle_face'],[13,13,'paddle_face'],
  // Head forward (rows 8-14)
  ...[8,9,10,11,12,13,14].flatMap(y => [9,10,11,12].map(x => [x,y,'skin'] as [number,number,ColorKey])),
  // Hair (rows 8-9)
  ...[8,9].flatMap(y => [9,10,11,12].map(x => [x,y,'hair'] as [number,number,ColorKey])),
];

interface Colors {
  skin: [number,number,number,number];
  hair: [number,number,number,number];
  body: [number,number,number,number];
  leg: [number,number,number,number];
  shoe: [number,number,number,number];
  paddle_handle: [number,number,number,number];
  paddle_face: [number,number,number,number];
}

function sampleColors(data: Buffer, width: number): Colors {
  // Sample from right-direction row (y offset 64), typing frame 1 (x offset 48)
  const baseX = 48, baseY = 64;
  return {
    skin:          samplePixel(data, width, baseX + 8,  baseY + 10),
    hair:          samplePixel(data, width, baseX + 8,  baseY + 9),
    body:          samplePixel(data, width, baseX + 5,  baseY + 18),
    leg:           samplePixel(data, width, baseX + 6,  baseY + 25),
    shoe:          samplePixel(data, width, baseX + 6,  baseY + 30),
    paddle_handle: toRgba(139, 69,  19),
    paddle_face:   toRgba(204, 51,  51),
  };
}

function drawFrame(
  dest: Buffer, destWidth: number,
  frameCol: number, dirRow: number,
  pixels: Array<[number,number,ColorKey]>,
  colors: Colors,
): void {
  const originX = frameCol * FW;
  const originY = dirRow;
  for (let y = 0; y < FH; y++) {
    for (let x = 0; x < FW; x++) {
      writePixel(dest, destWidth, originX + x, originY + y, TRANSPARENT);
    }
  }
  for (const [lx, ly, key] of pixels) {
    writePixel(dest, destWidth, originX + lx, originY + ly, colors[key]);
  }
}

const files = fs.readdirSync(CHARS_DIR).filter(f => /^char_\d+\.png$/.test(f)).sort();
console.log(`Processing ${files.length} character sprites...`);

for (const file of files) {
  const srcPath = path.join(CHARS_DIR, file);
  const src = PNG.sync.read(fs.readFileSync(srcPath));

  if (src.width !== W_OLD || src.height !== H) {
    console.log(`  ${file}: unexpected size ${src.width}×${src.height}, skipping`);
    continue;
  }

  const dest = new PNG({ width: W_NEW, height: H });
  // Copy existing pixels
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W_OLD; x++) {
      const si = (y * W_OLD + x) * 4;
      const di = (y * W_NEW + x) * 4;
      dest.data[di]   = src.data[si];
      dest.data[di+1] = src.data[si+1];
      dest.data[di+2] = src.data[si+2];
      dest.data[di+3] = src.data[si+3];
    }
  }

  const colors = sampleColors(src.data as unknown as Buffer, W_OLD);

  // Draw swing frames for each direction row (frame index 7 = swing1, 8 = swing2)
  for (const rowY of Object.values(ROWS)) {
    drawFrame(dest.data as unknown as Buffer, W_NEW, 7, rowY, SWING1_PIXELS, colors);
    drawFrame(dest.data as unknown as Buffer, W_NEW, 8, rowY, SWING2_PIXELS, colors);
  }

  fs.writeFileSync(srcPath, PNG.sync.write(dest));
  console.log(`  ${file}: expanded to 144×96`);
}
console.log('Done.');
```

- [ ] **Step 2: Run the script**

```bash
cd C:/Users/oohit/github/pixel-agents && npx tsx scripts/add-swing-frames.ts
```

Expected output:
```
Processing 6 character sprites...
  char_0.png: expanded to 144×96
  char_1.png: expanded to 144×96
  char_2.png: expanded to 144×96
  char_3.png: expanded to 144×96
  char_4.png: expanded to 144×96
  char_5.png: expanded to 144×96
Done.
```

- [ ] **Step 3: Verify PNG dimensions**

```bash
cd C:/Users/oohit/github/pixel-agents && node -e "
const {PNG} = require('pngjs');
const fs = require('fs');
const p = PNG.sync.read(fs.readFileSync('webview-ui/public/assets/characters/char_0.png'));
console.log(p.width, p.height);
"
```

Expected: `144 96`

- [ ] **Step 4: Run webview asset tests**

```bash
cd webview-ui && npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/add-swing-frames.ts webview-ui/public/assets/characters/
git commit -m "feat: extend character PNGs with swing frames (144x96)"
```

---

## Task 10: Renderer — ping pong ball arc flash

**Files:**
- Modify: `webview-ui/src/office/engine/renderer.ts`

- [ ] **Step 1: Update `renderScene` signature to accept sessions**

Change the `renderScene` export signature by adding `activitySessions` as a final optional parameter:

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

Add the import at the top:

```ts
import type { ActivitySession } from '../types.js';
```

- [ ] **Step 2: Add ping pong ball rendering after the z-sort drawables loop**

At the very end of `renderScene`, before the closing brace, add:

```ts
  // Ping pong ball arc flash
  if (activitySessions) {
    renderPingPongBalls(ctx, activitySessions, offsetX, offsetY, zoom);
  }
```

- [ ] **Step 3: Add `renderPingPongBalls` function**

Add this new function before `renderScene` (or after — keep it private to the module via no-export):

```ts
import {
  BALL_ARC_HEIGHT_PX,
  TILE_SIZE as _TILE_SIZE,
} from '../../constants.js';
```

(Add `BALL_ARC_HEIGHT_PX` to the existing constants import at the top of the file.)

Then add the function:

```ts
function renderPingPongBalls(
  ctx: CanvasRenderingContext2D,
  sessions: Map<string, ActivitySession>,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  for (const session of sessions.values()) {
    if (session.activityId !== 'ping_pong' || session.phase !== 'active') continue;

    const t = session.ballT;
    // Only visible in mid-flight (0.15..0.85) — fade in/out at edges
    if (t < 0.15 || t > 0.85) continue;
    const alpha = t < 0.25 ? (t - 0.15) / 0.1 : t > 0.75 ? (0.85 - t) / 0.1 : 1;

    // Left slot is at col = furnitureCol - 1, right slot at col = furnitureCol + 2
    const leftX = (session.furnitureCol - 1 + 0.5) * TILE_SIZE * zoom + offsetX;
    const rightX = (session.furnitureCol + 2 + 0.5) * TILE_SIZE * zoom + offsetX;
    const tableY = (session.furnitureRow + 0.5) * TILE_SIZE * zoom + offsetY;

    const ballX = leftX + t * (rightX - leftX);
    const arcOffset = Math.sin(t * Math.PI) * BALL_ARC_HEIGHT_PX * zoom;
    const ballY = tableY - arcOffset;

    // Trail (3 ghost dots fading behind)
    for (let i = 3; i >= 1; i--) {
      const tp = Math.max(0.15, t - i * 0.06);
      const tbx = leftX + tp * (rightX - leftX);
      const tby = tableY - Math.sin(tp * Math.PI) * BALL_ARC_HEIGHT_PX * zoom;
      ctx.globalAlpha = alpha * (1 - i / 4) * 0.35;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(tbx, tby, zoom, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ball
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ballX, ballY, zoom * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
```

- [ ] **Step 4: Update the call site in `OfficeCanvas.tsx` or wherever `renderScene` is called**

Search for `renderScene(` in the webview source:

```bash
cd webview-ui && grep -r "renderScene(" src/ --include="*.ts" --include="*.tsx" -l
```

Open the file(s) found and add the sessions argument. Example (the actual file will be `OfficeCanvas.tsx` or similar):

```ts
renderScene(
  ctx,
  officeState.furniture,
  officeState.getCharacters(),
  offsetX, offsetY, zoom,
  officeState.selectedAgentId,
  officeState.hoveredAgentId,
  officeState.getActivitySessions(),   // ← add this
);
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd webview-ui && npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add webview-ui/src/office/engine/renderer.ts webview-ui/src/office/components/OfficeCanvas.tsx
git commit -m "feat: render ping pong ball arc flash"
```

---

## Task 11: Renderer — activity overlays (steam, ZZZ)

**Files:**
- Modify: `webview-ui/src/office/engine/renderer.ts`

- [ ] **Step 1: Add `renderActivityOverlays` function to `renderer.ts`**

Add after `renderPingPongBalls`:

```ts
function renderActivityOverlays(
  ctx: CanvasRenderingContext2D,
  sessions: Map<string, ActivitySession>,
  offsetX: number,
  offsetY: number,
  zoom: number,
): void {
  const now = performance.now() / 1000;

  for (const session of sessions.values()) {
    if (session.phase !== 'active') continue;

    const cx = (session.furnitureCol + 0.5) * TILE_SIZE * zoom + offsetX;
    const cy = session.furnitureRow * TILE_SIZE * zoom + offsetY;

    if (session.activityId === 'coffee' || session.activityId === 'water_plant') {
      // Wispy steam: 3 small dots drifting upward, cycling ~1s
      const cycle = (now % 1);
      for (let i = 0; i < 3; i++) {
        const phase = (cycle + i / 3) % 1;
        const dotY = cy - phase * 12 * zoom;
        const dotX = cx + Math.sin(phase * Math.PI * 2) * 2 * zoom;
        ctx.globalAlpha = phase < 0.5 ? phase * 2 * 0.6 : (1 - phase) * 2 * 0.6;
        ctx.fillStyle = '#ccddff';
        ctx.beginPath();
        ctx.arc(dotX, dotY, zoom * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if (session.activityId === 'couch') {
      // Pulsing ZZZ text above the sofa
      const pulse = 0.7 + 0.3 * Math.sin(now * 1.5);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#aaccff';
      ctx.font = `bold ${Math.round(8 * zoom)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('Z z z', cx, cy - 6 * zoom);
      ctx.globalAlpha = 1;
    }
  }
}
```

- [ ] **Step 2: Call `renderActivityOverlays` inside `renderScene`**

After the `renderPingPongBalls` call, add:

```ts
  if (activitySessions) {
    renderActivityOverlays(ctx, activitySessions, offsetX, offsetY, zoom);
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd webview-ui && npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add webview-ui/src/office/engine/renderer.ts
git commit -m "feat: activity overlays (steam, ZZZ)"
```

---

## Task 12: Tag existing furniture manifests

**Files:**
- Modify: `webview-ui/public/assets/furniture/SOFA/manifest.json`
- Modify: `webview-ui/public/assets/furniture/WHITEBOARD/manifest.json`
- Modify: `webview-ui/public/assets/furniture/BOOKSHELF/manifest.json`
- Modify: `webview-ui/public/assets/furniture/PLANT/manifest.json`

- [ ] **Step 1: Tag SOFA**

In `SOFA/manifest.json`, add after `"backgroundTiles": 0`:

```json
  "activityId": "couch",
  "activityMinPlayers": 1,
  "activitySlots": [
    { "offsetCol": 0, "offsetRow": 1, "facingDir": "up" },
    { "offsetCol": 1, "offsetRow": 1, "facingDir": "up" }
  ],
```

(Slots are in front of the sofa — one tile below each seat tile for front-facing SOFA_FRONT.)

- [ ] **Step 2: Tag WHITEBOARD**

In `WHITEBOARD/manifest.json`, add after `"backgroundTiles": 0`:

```json
  "activityId": "whiteboard",
  "activityMinPlayers": 2,
  "activitySlots": [
    { "offsetCol": 0, "offsetRow": 2, "facingDir": "up" },
    { "offsetCol": 1, "offsetRow": 2, "facingDir": "up" },
    { "offsetCol": -1, "offsetRow": 2, "facingDir": "up" }
  ],
```

(3 slots standing in front of the whiteboard, facing up toward the wall.)

- [ ] **Step 3: Tag BOOKSHELF**

In `BOOKSHELF/manifest.json`, add after `"backgroundTiles": 0`:

```json
  "activityId": "bookshelf",
  "activityMinPlayers": 1,
  "activitySlots": [
    { "offsetCol": 0, "offsetRow": 1, "facingDir": "up" }
  ],
```

- [ ] **Step 4: Tag PLANT**

In `PLANT/manifest.json`, add after `"backgroundTiles": 0`:

```json
  "activityId": "water_plant",
  "activityMinPlayers": 1,
  "activitySlots": [
    { "offsetCol": 0, "offsetRow": 1, "facingDir": "up" }
  ],
```

- [ ] **Step 5: Commit**

```bash
git add webview-ui/public/assets/furniture/SOFA/manifest.json webview-ui/public/assets/furniture/WHITEBOARD/manifest.json webview-ui/public/assets/furniture/BOOKSHELF/manifest.json webview-ui/public/assets/furniture/PLANT/manifest.json
git commit -m "feat: tag SOFA, WHITEBOARD, BOOKSHELF, PLANT as activity spots"
```

---

## Task 13: PING_PONG_TABLE furniture asset

**Files:**
- Create: `webview-ui/public/assets/furniture/PING_PONG_TABLE/manifest.json`
- Create: `scripts/generate-ping-pong-table.ts`
- Output: `webview-ui/public/assets/furniture/PING_PONG_TABLE/PING_PONG_TABLE.png`

- [ ] **Step 1: Create the manifest**

Create `webview-ui/public/assets/furniture/PING_PONG_TABLE/manifest.json`:

```json
{
  "id": "PING_PONG_TABLE",
  "name": "Ping Pong Table",
  "category": "misc",
  "type": "asset",
  "canPlaceOnWalls": false,
  "canPlaceOnSurfaces": false,
  "backgroundTiles": 0,
  "file": "PING_PONG_TABLE.png",
  "width": 32,
  "height": 16,
  "footprintW": 2,
  "footprintH": 1,
  "activityId": "ping_pong",
  "activityMinPlayers": 2,
  "activitySlots": [
    { "offsetCol": -1, "offsetRow": 0, "facingDir": "right" },
    { "offsetCol": 2,  "offsetRow": 0, "facingDir": "left" }
  ]
}
```

- [ ] **Step 2: Create `scripts/generate-ping-pong-table.ts`**

```ts
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
const OUT = path.resolve(__dirname, '../webview-ui/public/assets/furniture/PING_PONG_TABLE/PING_PONG_TABLE.png');

const W = 32, H = 16;
const png = new PNG({ width: W, height: H });

// Fill transparent
for (let i = 0; i < png.data.length; i++) png.data[i] = 0;

function px(x: number, y: number, r: number, g: number, b: number, a = 255): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  png.data[i] = r; png.data[i+1] = g; png.data[i+2] = b; png.data[i+3] = a;
}

// Table surface (green): rows 6-10, cols 2-29
for (let y = 6; y <= 10; y++) {
  for (let x = 2; x <= 29; x++) {
    px(x, y, 45, 122, 58);
  }
}
// White center line: col 15-16, rows 6-10
for (let y = 6; y <= 10; y++) { px(15, y, 255, 255, 255); px(16, y, 255, 255, 255); }
// Net: col 15-16, rows 4-6 (stands above table)
for (let y = 4; y <= 6; y++) { px(15, y, 230, 230, 230); px(16, y, 230, 230, 230); }
// Table border: dark green outline
for (let x = 2; x <= 29; x++) { px(x, 6, 28, 80, 38); px(x, 10, 28, 80, 38); }
for (let y = 6; y <= 10; y++) { px(2, y, 28, 80, 38); px(29, y, 28, 80, 38); }
// Table legs: 4 corners
[[3,11],[3,12],[3,13],[28,11],[28,12],[28,13]].forEach(([x,y]) => px(x,y,80,50,30));
// Shadow under table
for (let x = 4; x <= 28; x++) { px(x, 14, 0, 0, 0, 40); }

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, PNG.sync.write(png));
console.log('Written:', OUT);
```

- [ ] **Step 3: Run the script**

```bash
cd C:/Users/oohit/github/pixel-agents && npx tsx scripts/generate-ping-pong-table.ts
```

Expected: `Written: .../PING_PONG_TABLE.png`

- [ ] **Step 4: Run webview tests**

```bash
cd webview-ui && npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add webview-ui/public/assets/furniture/PING_PONG_TABLE/ scripts/generate-ping-pong-table.ts
git commit -m "feat: PING_PONG_TABLE furniture asset"
```

---

## Task 14: COFFEE_MACHINE furniture asset

**Files:**
- Create: `webview-ui/public/assets/furniture/COFFEE_MACHINE/manifest.json`
- Create: `scripts/generate-coffee-machine.ts`
- Output: `webview-ui/public/assets/furniture/COFFEE_MACHINE/COFFEE_MACHINE.png`

- [ ] **Step 1: Create the manifest**

Create `webview-ui/public/assets/furniture/COFFEE_MACHINE/manifest.json`:

```json
{
  "id": "COFFEE_MACHINE",
  "name": "Coffee Machine",
  "category": "electronics",
  "type": "asset",
  "canPlaceOnWalls": false,
  "canPlaceOnSurfaces": false,
  "backgroundTiles": 0,
  "file": "COFFEE_MACHINE.png",
  "width": 16,
  "height": 32,
  "footprintW": 1,
  "footprintH": 1,
  "activityId": "coffee",
  "activityMinPlayers": 1,
  "activitySlots": [
    { "offsetCol": 0, "offsetRow": 1, "facingDir": "up" }
  ]
}
```

- [ ] **Step 2: Create `scripts/generate-coffee-machine.ts`**

```ts
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
const OUT = path.resolve(__dirname, '../webview-ui/public/assets/furniture/COFFEE_MACHINE/COFFEE_MACHINE.png');

const W = 16, H = 32;
const png = new PNG({ width: W, height: H });
for (let i = 0; i < png.data.length; i++) png.data[i] = 0;

function px(x: number, y: number, r: number, g: number, b: number, a = 255): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  png.data[i] = r; png.data[i+1] = g; png.data[i+2] = b; png.data[i+3] = a;
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
[5,7,9].forEach(x => { px(x, 19, 220, 50, 50); px(x+1, 19, 220, 50, 50); });
// Drip tray: rows 25-27, cols 3-12 (darker)
for (let y = 25; y <= 27; y++) for (let x = 3; x <= 12; x++) px(x, y, 45, 45, 55);
// Cup slot: rows 22-24, cols 6-9 (hollow dark)
for (let y = 22; y <= 24; y++) for (let x = 6; x <= 9; x++) px(x, y, 30, 30, 35);
// Machine sides highlight
for (let y = 11; y <= 27; y++) { px(3, y, 110, 110, 120); px(12, y, 50, 50, 58); }
// Shadow
for (let x = 4; x <= 12; x++) px(x, 29, 0, 0, 0, 50);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, PNG.sync.write(png));
console.log('Written:', OUT);
```

- [ ] **Step 3: Run the script**

```bash
cd C:/Users/oohit/github/pixel-agents && npx tsx scripts/generate-coffee-machine.ts
```

Expected: `Written: .../COFFEE_MACHINE.png`

- [ ] **Step 4: Run webview tests**

```bash
cd webview-ui && npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add webview-ui/public/assets/furniture/COFFEE_MACHINE/ scripts/generate-coffee-machine.ts
git commit -m "feat: COFFEE_MACHINE furniture asset"
```

---

## Task 15: Full build and smoke test

**Files:** none (verification only)

- [ ] **Step 1: Full build**

```bash
cd C:/Users/oohit/github/pixel-agents && npm run build
```

Expected: build completes with no TypeScript errors.

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: all tests pass (webview + server).

- [ ] **Step 3: Launch Extension Dev Host and verify visually**

Press `F5` in VS Code to open Extension Dev Host. Open a workspace. Add 2+ Claude agents. Let them go idle. Verify:
1. After wandering, characters walk to the ping pong table and a ball arc appears between them
2. Characters visit the coffee machine and a steam wisp renders above it
3. Characters nap on the sofa with ZZZ overlay
4. An active agent (Claude running) immediately leaves any activity and walks back to their seat
5. The new PING_PONG_TABLE and COFFEE_MACHINE appear in the editor palette under their categories

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: activity system — ping pong, coffee, couch, whiteboard, plant, bookshelf"
```
