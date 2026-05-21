# Activity System Design

**Date:** 2026-05-20
**Sub-project:** 1 of 2 (Activity System first; Sprite Customizer separate)

## Overview

Add an idle activity system to Pixel Agents so that idle characters organically seek out and participate in office activities — ping pong, coffee machine, couch nap, whiteboard huddle, watering the plant, and browsing the bookshelf. Characters still wander and return to seats; activities are punctuation in that rhythm.

This is sub-project 1. The in-app sprite customizer is a separate, independent sub-project.

---

## Decisions

| Question | Answer |
|---|---|
| Ping pong table size | 2×1 tiles, horizontal |
| Activity discovery | Global — any idle character can seek any activity anywhere in the office |
| Ball animation | Arc flash with alpha trail (ball visible mid-flight only, 0.15–0.85 of rally) |
| Character swing | New sprite frames (B) — wind-up + follow-through added to sprite sheet |
| Architecture | `ActivityManager` class (Option 3) |

---

## Section 1 — Data Model & Types

### Catalog additions

`FurnitureCatalogEntry` (in `furnitureCatalog.ts` / manifest JSON) gains three new optional fields:

```ts
activityId?: string         // e.g. "ping_pong", "coffee", "bookshelf"
activityMinPlayers?: number // session goes active when this many have arrived (default 1)
activitySlots?: ActivitySlot[]
```

```ts
interface ActivitySlot {
  offsetCol: number    // relative to furniture origin col
  offsetRow: number    // relative to furniture origin row
  facingDir: Direction
}
```

`activityMinPlayers` distinguishes solo-start activities from multi-player ones:
- ping_pong: `minPlayers: 2` — rally only begins once both players arrive
- whiteboard: `minPlayers: 2` — huddle starts once 2 arrive; a 3rd can join mid-session
- coffee / water_plant / bookshelf: `minPlayers: 1` — solo, starts immediately on arrival
- couch: `minPlayers: 1` — one person can nap alone; a 2nd can claim the other slot and nap alongside independently

Example — ping pong table (2×1 horizontal):
```json
"activityId": "ping_pong",
"activityMinPlayers": 2,
"activitySlots": [
  { "offsetCol": -1, "offsetRow": 0, "facingDir": "right" },
  { "offsetCol": 2,  "offsetRow": 0, "facingDir": "left"  }
]
```

### New types (in `types.ts`)

```ts
interface ActivitySession {
  id: string                        // furniture UID — one session per piece of furniture
  activityId: string
  furnitureCol: number
  furnitureRow: number
  slots: ActivitySlotState[]        // one per activitySlots entry
  phase: 'waiting' | 'active'       // waiting = not all required players arrived yet
  timer: number                     // general-purpose (rally timer, pour timer, etc.)
  // ping_pong only:
  ballT?: number                    // 0..1 position along table (left=0, right=1)
  ballDir?: 1 | -1                  // direction of travel
}

interface ActivitySlotState {
  participantId: number | null
  arrived: boolean
}
```

### Character changes

`Character` gains one field: `activitySessionId: string | null` (null = not in any activity).

`CharacterState` gains one value: `ACTIVITY`. Total FSM states: 4 (IDLE, WALK, TYPE, ACTIVITY).

---

## Section 2 — ActivityManager

**File:** `webview-ui/src/office/engine/activityManager.ts`

Owned by `OfficeState` as `this.activityManager`. Receives layout furniture + characters on each `update()` call. Tracks sessions in `Map<string, ActivitySession>` keyed by furniture UID.

### Methods

**`tryJoin(ch, placedFurniture, characters)`**
- Called from idle wander logic (~25% chance per wander cycle, `ACTIVITY_SEEK_CHANCE = 0.25`)
- Scans all placed furniture with a matching `activityId`
- For each, finds or creates a session, checks for an open slot
- On success: reserves the slot, sets `ch.activitySessionId`, returns `{ session, slotIndex, targetCol, targetRow }`
- Returns null if nothing available

**`arrive(ch)`**
- Called when a walking character reaches their reserved slot tile
- Marks `slot.arrived = true`
- If all slots are now arrived → sets `session.phase = 'active'`

**`leave(ch)`**
- Called when `ch.isActive` flips true (agent gets a prompt) or session timer expires naturally
- Frees the slot (`participantId = null, arrived = false`)
- Clears `ch.activitySessionId`, resets `ch.state = CharacterState.IDLE`
- For multi-player activities: calls `leave()` on all remaining participants (ping pong, whiteboard require all players)

**`update(dt, characters)`**
- Advances all sessions; per-activity handlers:
  - **ping_pong:** advance `ballT` by `ballDir * BALL_SPEED * dt`; flip `ballDir` at 0 and 1; swing frame driven by proximity of `ballT` to each end
  - **coffee:** pour timer ~3s → session ends, `leave()` all
  - **couch:** rest timer 10–30s (random on session start) → session ends
  - **whiteboard:** presenter index cycles every ~8s among `arrived` slots
  - **water_plant:** pour timer ~2s → session ends
  - **bookshelf:** read timer 5–15s → session ends

---

## Section 3 — Idle Behavior & Rendering

### Idle behavior change (`characters.ts`)

In `updateCharacter()`, `IDLE` case, just before the existing wander timer fires:

```ts
if (ch.wanderTimer <= 0 && !ch.activitySessionId) {
  if (Math.random() < ACTIVITY_SEEK_CHANCE) {
    const result = activityManager.tryJoin(ch, furniture, characters);
    if (result) {
      // pathfind ch to result.targetCol/Row
      // set ch.state = CharacterState.WALK
      // on arrival: activityManager.arrive(ch)
      break;
    }
  }
  // existing wander logic unchanged
}
```

`ACTIVITY` case in `updateCharacter()`: minimal — tick `frameTimer` only. `ActivityManager.update()` drives all session state.

When `setAgentActive(id, true)` fires, `OfficeState` calls `activityManager.leave(ch)` before pathfinding to seat.

### Rendering (`renderer.ts`)

**Character sprites during activities** — mapped per activity using existing frames:
- ping_pong → `swing` frames on hit, `walk[dir][1]` (standing) while waiting
- coffee / water_plant → `typing` frames (leaning in)
- couch → `walk[dir][1]` with sitting offset
- whiteboard presenter → `typing`; audience → `reading`
- bookshelf → `reading`

**Ping pong ball** — rendered as a separate pass (after furniture, before characters):
- 2×2 white pixel dot at `lerp(leftSlotX, rightSlotX, session.ballT)`
- Y offset: `sin(ballT * π) * ARC_HEIGHT` above table surface
- Alpha: 0 at `ballT < 0.15` and `ballT > 0.85`, full 0.15–0.85
- 3-frame alpha trail behind current position

**Overhead overlays** — drawn above furniture tile during active sessions (same layer as speech bubbles):
- coffee/water_plant: small steam puff sprite (2–3 pixel animation)
- couch: ZZZ sprite pulsing slowly (reuse or extend bubble system)

---

## Section 4 — New Sprite Frames

The character sprite sheet expands from **7 frames × 16px = 112px wide** to **9 frames × 16px = 144px wide**.

Two new frames added per direction row:
- **Frame 8 (swing1):** wind-up — character leans back, arm pulled behind body, paddle visible at rear
- **Frame 9 (swing2):** follow-through — character lunges forward, arm fully extended, paddle past body edge

Left direction generated at runtime by flipping right-facing frames (same as existing walk/type/read).

Down and up rows get matching swing frames (body faces camera / away from camera).

### Code changes

`CharacterSprites` interface gains:
```ts
swing: Record<Direction, [SpriteData, SpriteData]>  // [wind-up, follow-through]
```

`spriteData.ts`: `getCharacterSprites()` reads frames at indices 7 and 8 from loaded PNG data.

`assetLoader.ts` (extension side): sprite slice dimensions updated from 112px to 144px wide.

`export-characters.ts`: 2 new pixel template definitions (swing1, swing2) for the right-facing row; down/up variants added. All 6 character PNGs regenerated.

`getCharacterSprite()` in `characters.ts`: add `ACTIVITY` case. Receives an optional `ActivitySession` param. For `ping_pong` sessions: returns `swing[1]` (follow-through) when `ballT` is within 0.12 of the character's end, `swing[0]` (wind-up) within 0.25, otherwise `walk[dir][1]` (standing). For all other activities: returns the per-activity frame defined in the renderer table above.

---

## Section 5 — Furniture Assets

### Existing furniture — add `activityId` to manifest only

| Asset | Activity ID | Slots | Notes |
|---|---|---|---|
| `SOFA` (2×1) | `"couch"` | Left + right of sofa front | 2 max participants |
| `WHITEBOARD` (2×2 wall) | `"whiteboard"` | 3 tiles in front row | 2–3 participants; first = presenter |
| `BOOKSHELF` (2×1 wall) | `"bookshelf"` | 1 tile centered in front | Solo |
| `PLANT` / `LARGE_PLANT` | `"water_plant"` | 1 adjacent tile | Solo |

### New furniture — new PNG + manifest

**`PING_PONG_TABLE`** (2×1 floor item)
- Green table surface with white center line and net
- `activityId: "ping_pong"`, 2 slots (left + right)
- New sprite via asset pipeline

**`COFFEE_MACHINE`** (1×1 floor item)
- Standalone espresso/drip machine (existing `COFFEE` is a surface mug — not usable here)
- `activityId: "coffee"`, 1 slot (adjacent tile, facing machine)
- New sprite via asset pipeline

### Catalog constants

New constants in `webview-ui/src/constants.ts`:
```ts
ACTIVITY_SEEK_CHANCE = 0.25     // probability per wander cycle to seek an activity
BALL_SPEED = 0.6                // ballT units per second (full table length = 1.0)
BALL_ARC_HEIGHT_PX = 12         // max arc above table surface at ballT=0.5
```

---

## File Change Summary

| File | Change |
|---|---|
| `webview-ui/src/office/types.ts` | Add `ActivitySession`, `ActivitySlotState`, `CharacterState.ACTIVITY`, `Character.activitySessionId` |
| `webview-ui/src/office/engine/activityManager.ts` | **New file** — `ActivityManager` class |
| `webview-ui/src/office/engine/officeState.ts` | Own `ActivityManager`, wire `update()`, `setAgentActive()`, `leave()` |
| `webview-ui/src/office/engine/characters.ts` | Add activity seek in `IDLE` case; add `ACTIVITY` case; update `getCharacterSprite()` |
| `webview-ui/src/office/engine/renderer.ts` | Ball arc pass; swing frame selection; steam/ZZZ overlays |
| `webview-ui/src/office/sprites/spriteData.ts` | Add `swing` to `CharacterSprites`; read frames 7–8 |
| `webview-ui/src/office/layout/furnitureCatalog.ts` | Add `activityId`, `activitySlots` to `FurnitureCatalogEntry` |
| `webview-ui/src/constants.ts` | Add activity constants |
| `scripts/export-characters.ts` | Add swing frame templates; output 144px-wide PNGs |
| `src/assetLoader.ts` | Update sprite slice width 112→144 |
| `webview-ui/public/assets/furniture/SOFA/manifest.json` | Add `activityId: "couch"`, `activitySlots` |
| `webview-ui/public/assets/furniture/WHITEBOARD/manifest.json` | Add `activityId: "whiteboard"`, `activitySlots` |
| `webview-ui/public/assets/furniture/BOOKSHELF/manifest.json` | Add `activityId: "bookshelf"`, `activitySlots` |
| `webview-ui/public/assets/furniture/PLANT/manifest.json` | Add `activityId: "water_plant"`, `activitySlots` |
| `webview-ui/public/assets/furniture/PING_PONG_TABLE/` | **New** — PNG + manifest |
| `webview-ui/public/assets/furniture/COFFEE_MACHINE/` | **New** — PNG + manifest |

---

## Out of Scope (Sub-project 2)

- In-app sprite customizer / pixel editor
- Foosball table
- Spectator/watching mechanic for activities
