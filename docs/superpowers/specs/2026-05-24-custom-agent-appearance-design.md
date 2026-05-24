# Custom Agent Appearance — Design Spec

**Date:** 2026-05-24  
**Status:** Approved

## Overview

Allow users to assign a specific character sprite variant to any agent in the pixel office, replacing the current auto-assignment system. Users right-click an agent and pick from a grid of pre-made variants — each a fully baked sprite sheet with a unique combination of hair style, outfit, and color palette.

## Scope

- **In:** Variant picker UI, right-click context menu entry, dynamic variant loading, persistence, auto-assignment update
- **Out:** Runtime compositing, free color pickers, hue shift per-region, non-Claude agents, display name labels

---

## 1. Sprite Variants

### Format

All character sprite sheets live in `webview-ui/public/assets/characters/` and follow the existing naming convention: `char_0.png`–`char_5.png` are the 6 original skins. New variants are added as `char_6.png`, `char_7.png`, etc.

Each file is a **176×96 PNG** (11 frames × 16px wide, 3 direction rows × 32px tall with 8px top padding). Row 0 = down, Row 1 = up, Row 2 = right. Left is flipped right at runtime. Frame order: walk1, walk2, walk3, type1, type2, read1, read2, pingPongWindup, pingPongHit, whiteboardPresent, whiteboardWatch.

### Loading

`assetLoader.ts` already scans `assets/characters/` dynamically. The resulting array is sent to the webview via `characterSpritesLoaded`. No changes needed to the load path — adding a new PNG is sufficient.

New variants can also be placed in an external asset directory (same `externalAssetDirectories` mechanism used for furniture).

### Palette index

The `palette` field on `Character` and `PersistedAgent` is an integer variant index (0–N). Existing saved agents on indices 0–5 remain valid with no migration needed.

---

## 2. Picker UI

### Entry point

In normal mode (not edit mode), right-clicking a character hit-tests the canvas and opens a context menu. A new **"Customize Agent"** item is added to this menu. Right-click in edit mode continues to be suppressed.

### Picker panel

Clicking "Customize Agent" opens a **small floating panel** anchored near the character in canvas coordinates, converted to screen coordinates for positioning. Visual style matches other overlays:

- `background: #1e1e2e`
- `border: 2px solid` (using `--pixel-border`)
- `box-shadow: 2px 2px 0px #0a0a14`
- `border-radius: 0`
- FS Pixel Sans font

The panel contains a **scrollable grid of variant thumbnails**. Each thumbnail renders the variant's idle/walk frame (frame index 1 = walk2 = standing pose) at a fixed zoom (e.g., 3×) facing down. The currently-assigned variant gets a white `2px solid` border highlight. All others have a transparent border.

**Interactions:**

- Click a thumbnail → apply variant instantly (live update on character), close panel
- Click outside panel → dismiss, no change
- Panel is a React portal rendered over the canvas, positioned absolutely

### No confirm/cancel

Changes apply on click with no confirmation step. Since the choice is easily reversible (right-click again), no undo entry is needed.

---

## 3. Persistence & Auto-assignment

### Persistence

`palette` is already persisted in `PersistedAgent` and restored via `existingAgents` on webview ready. No schema changes required.

When the user picks a variant, the webview sends a `setAgentPalette` message:

```ts
{ type: 'setAgentPalette', agentId: number, palette: number }
```

`PixelAgentsViewProvider` handles this message by:

1. Looking up the agent by `agentId` — silently no-ops if not found (agent may have closed)
2. Updating `agent.palette` in `AgentState`
3. Persisting the updated `PersistedAgent` to `workspaceState`
4. Broadcasting `agentPaletteChanged` (`{ agentId, palette }`) to all webview instances

### Auto-assignment

`pickDiversePalette()` in `officeState.ts` currently cycles over indices 0–5. It is updated to use the total count of loaded variants (`characterSprites.length`) so new variants are included in the rotation.

User-picked variants are stored with `hueShift = 0` — the baked art is the intended look. The existing hue-shift auto-rotation still applies when auto-assignment repeats a palette index beyond the available variants.

---

## 4. Message Flow

```
User right-clicks agent
  → OfficeCanvas hit-test → context menu shown
  → User clicks "Customize Agent"
  → Picker panel opens (React portal, positioned near character)
  → User clicks variant thumbnail
  → officeState.setCharacterPalette(agentId, palette)   ← instant local update
  → webview postMessage({ type: 'setAgentPalette', agentId, palette })
  → extension PixelAgentsViewProvider
      → updates AgentState.palette
      → persists PersistedAgent to workspaceState
      → broadcasts agentPaletteChanged to all webview instances
  → other webview windows update their character
```

---

## 5. Asset Pipeline

New variants are hand-drawn PNG files matching the 176×96 format. Steps to add a variant:

1. Draw the sprite sheet (or export from a pixel art tool)
2. Drop it into `webview-ui/public/assets/characters/` as `char_N.png`
3. Run `npm run build` — the build copies it to `dist/assets/characters/` automatically
4. Repackage the VSIX

No catalog files, no scripts, no code changes needed for new variants.

---

## 6. Files Touched

| File                                                | Change                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| `webview-ui/src/office/engine/officeState.ts`       | `pickDiversePalette()` uses variant count; add `setCharacterPalette()`  |
| `webview-ui/src/hooks/useExtensionMessages.ts`      | Handle `agentPaletteChanged` message                                    |
| `webview-ui/src/office/components/OfficeCanvas.tsx` | Right-click → hit-test → context menu; picker panel portal              |
| `webview-ui/src/office/sprites/spriteCache.ts`      | Ensure cache keying works for indices beyond 5 (likely already correct) |
| `src/PixelAgentsViewProvider.ts`                    | Handle `setAgentPalette`; broadcast `agentPaletteChanged`               |
| `src/types.ts`                                      | No changes — `palette: number` already supports 0–N                     |
| `webview-ui/public/assets/characters/`              | New `char_6.png`+ variant files (art work)                              |
