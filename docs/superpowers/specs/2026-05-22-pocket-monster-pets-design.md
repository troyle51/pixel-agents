# Pocket Monster Pets — Design Spec

**Date:** 2026-05-22  
**Status:** Approved

## Summary

Add 3–5 ambient pocket monster pet NPCs that roam the office independently. Pets are purely visual/atmospheric — they wander walkable tiles, occasionally approach idle agents or interesting furniture (activities), and are randomly selected from loaded species assets on each startup. They have no seat assignment, no agent binding, no persistence, and are not selectable or interactive.

---

## 1. Entity & State

A new `Pet` interface is added to `webview-ui/src/office/types.ts`:

```ts
export const PetState = {
  IDLE: 'idle',
  WALK: 'walk',
} as const;
export type PetState = (typeof PetState)[keyof typeof PetState];

export interface Pet {
  id: number;
  speciesId: string; // matches PNG filename stem (e.g. "pikachu")
  state: PetState;
  dir: Direction;
  x: number; // pixel position (center)
  y: number;
  tileCol: number;
  tileRow: number;
  path: Array<{ col: number; row: number }>;
  moveProgress: number;
  frame: number;
  frameTimer: number;
  wanderTimer: number; // countdown to next wander decision (seconds)
}
```

`OfficeState` gains:

- `pets: Map<number, Pet>` — keyed by pet ID (positive integers, distinct from agent IDs which can be negative for sub-agents)
- `spawnPets(loadedSpecies: string[])` — picks `random(PET_COUNT_MIN, PET_COUNT_MAX)` species without replacement (cycling if fewer species than count), places each on a random walkable tile, populates `this.pets`
- A private `nextPetId` counter starting at `1` (pets live in their own Map — IDs do not need to be globally unique across the `characters` Map)

Pets are **not persisted** — `spawnPets()` is called fresh on each startup after sprites load.

---

## 2. Sprite Format & Loading Pipeline

### PNG convention

Each species is a single PNG file named `<speciesId>.png` stored under `webview-ui/public/assets/pets/`.

Layout:

```
3 rows × N columns
  Row 0 = Down direction frames
  Row 1 = Up direction frames
  Row 2 = Right direction frames   (Left = flipped Right at runtime)

Frame size: frameH = imageHeight / 3   (square frames)
            frameW = imageHeight / 3
Frame count: N = imageWidth / frameW
Idle pose: frame 0 (standing still)
```

No companion JSON — all structure inferred from image dimensions.

### Conversion script

`scripts/convert-pmd-sprite.ts` — a one-shot CLI tool. Given a pmdcollab ZIP (which contains `WanderingAround.png` and `AnimData.xml`), it:

1. Reads `AnimData.xml` to determine frame size and count per direction
2. Extracts rows for cardinal directions S (→ Down), N (→ Up), E (→ Right) from the 8-direction sheet
3. Strips the shadow channel (pmdcollab sprites include a separate shadow row per direction)
4. Writes the 3-row output PNG to `webview-ui/public/assets/pets/<speciesId>.png`

Usage: `npx ts-node scripts/convert-pmd-sprite.ts <path/to/species.zip> <speciesId>`

### Loading pipeline

```
Extension (src/assetLoader.ts)
  loadPetSprites(context)
    → scan dist/assets/pets/*.png
    → pngjs parse (same PNG_ALPHA_THRESHOLD as character sprites)
    → split into 3 rows × N frames of SpriteData
    → return { speciesId, frames: SpriteData[][] }[]   (indexed [row][frame])

PixelAgentsViewProvider.ts
  → sends petSpritesLoaded: { species: { speciesId, frames }[] } to webview

Webview (webview-ui/src/office/sprites/petSpriteData.ts)
  setPetSprites(data)  → stores Map<speciesId, SpriteData[][]>
  getPetSprite(speciesId, dir, frame) → SpriteData

useExtensionMessages.ts
  handles 'petSpritesLoaded'
    → calls setPetSprites()
    → calls officeState.spawnPets(loadedSpeciesIds)
```

**Load order:** `petSpritesLoaded` fires after `furnitureAssetsLoaded`, before `layoutLoaded`.

If no pet PNGs are found, `petSpritesLoaded` is still sent with an empty array — pets simply don't spawn.

---

## 3. Behavior (Pet FSM)

Implemented in `webview-ui/src/office/engine/pets.ts` as `updatePet()`.

### IDLE state

Pet stands still (frame 0), counting down `wanderTimer`. When `wanderTimer <= 0`:

Pick a target tile using this weighted random selection:

| Chance                                | Target                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 30% (`PET_APPROACH_AGENT_CHANCE`)     | A walkable tile within 2 tiles (Manhattan distance) of a randomly chosen non-active (idle/wandering) agent |
| 20% (`PET_APPROACH_FURNITURE_CHANCE`) | A walkable tile within 2 tiles of a randomly chosen furniture item with an `activityId`                    |
| 50%                                   | A random walkable tile                                                                                     |

Each target is attempted in order. If the preferred target has no idle agents / no activity furniture / no BFS path, fall back to the next tier, ending at a random walkable tile (which always succeeds if any walkable tiles exist). On transition to WALK, a new `wanderTimer` is set for when the pet arrives (so it pauses briefly before wandering again).

### WALK state

Pet moves along `path` tile-by-tile using linear interpolation at `PET_WALK_SPEED_PX_PER_SEC`. Walk frames cycle using up to the first 4 frames: `frame = (frame + 1) % Math.min(4, frameCount)`. When path completes:

- Snap to tile center
- Transition to IDLE
- Set `wanderTimer = random(PET_WANDER_PAUSE_MIN_SEC, PET_WANDER_PAUSE_MAX_SEC)`

### New constants (`webview-ui/src/constants.ts`)

```ts
PET_COUNT_MIN = 3;
PET_COUNT_MAX = 5;
PET_WANDER_PAUSE_MIN_SEC = 2.0;
PET_WANDER_PAUSE_MAX_SEC = 8.0;
PET_WALK_SPEED_PX_PER_SEC = 32; // slightly slower than agents (48)
PET_WALK_FRAME_DURATION_SEC = 0.15; // matches character walk
PET_APPROACH_AGENT_CHANCE = 0.3;
PET_APPROACH_FURNITURE_CHANCE = 0.2;
```

---

## 4. Rendering Integration

Pets are included in the existing z-sort entity pass in `renderer.ts`. No new render pass.

**Z-sort value:** `pet.y + TILE_SIZE / 2 + CHARACTER_Z_SORT_OFFSET`

**Sprite draw:** `getCachedSprite(getPetSprite(pet.speciesId, pet.dir, pet.frame), zoom)` — reuses the existing sprite cache infrastructure.

**Pixel position:** drawn at `(pet.x - frameW/2 * zoom, pet.y - frameH * zoom)` — same bottom-center anchoring as characters.

**No outline, no bubble, no click selection, no matrix effect.** Pets are purely ambient — they appear on startup without fanfare and cannot be interacted with.

---

## 5. File Manifest

### New files

| File                                             | Purpose                                              |
| ------------------------------------------------ | ---------------------------------------------------- |
| `webview-ui/src/office/engine/pets.ts`           | `Pet` type re-export, `createPet()`, `updatePet()`   |
| `webview-ui/src/office/sprites/petSpriteData.ts` | Sprite storage, `setPetSprites()`, `getPetSprite()`  |
| `scripts/convert-pmd-sprite.ts`                  | One-shot pmdcollab ZIP → pet PNG conversion tool     |
| `webview-ui/public/assets/pets/`                 | Directory for per-species PNG files (user-populated) |

### Modified files

| File                                           | Change                                           |
| ---------------------------------------------- | ------------------------------------------------ |
| `webview-ui/src/office/types.ts`               | Add `Pet`, `PetState`                            |
| `webview-ui/src/constants.ts`                  | Add pet constants                                |
| `webview-ui/src/office/engine/officeState.ts`  | Add `pets` map, `nextPetId`, `spawnPets()`       |
| `webview-ui/src/office/engine/gameLoop.ts`     | Call `updatePet()` for each pet each frame       |
| `webview-ui/src/office/engine/renderer.ts`     | Include pets in z-sort entity array              |
| `src/assetLoader.ts`                           | Add `loadPetSprites()`                           |
| `src/PixelAgentsViewProvider.ts`               | Call `loadPetSprites()`, send `petSpritesLoaded` |
| `webview-ui/src/hooks/useExtensionMessages.ts` | Handle `petSpritesLoaded` message                |

---

## 6. Out of Scope (this version)

- Pet names / tooltips on hover
- Clickable / selectable pets
- Matrix spawn/despawn effect for pets
- Pets persisted in layout or config
- Pets reacting to specific agent tools or events
- External asset directory support for pet sprites
- Settings UI to manage pet roster
