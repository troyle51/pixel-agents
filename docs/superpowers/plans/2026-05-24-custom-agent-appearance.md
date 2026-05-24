# Custom Agent Appearance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add right-click → "Customize Agent" context menu to the pixel office, opening a variant picker panel where users can assign any loaded character sprite sheet to a specific agent.

**Architecture:** Extend `OfficeState` with `setCharacterPalette()`, update `OfficeCanvas` right-click handling to detect character hits and fire a new `onAgentContextMenu` callback, add `VariantPicker` React component rendered as a portal in `App.tsx`, and wire a `setAgentPalette` / `agentPaletteChanged` message round-trip for persistence and cross-window sync.

**Tech Stack:** React 19, TypeScript, VS Code Webview API, Canvas 2D API (thumbnail rendering), Node test runner (webview tests)

---

## File Map

| File                                                 | Change                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| `webview-ui/src/office/engine/officeState.ts`        | Add `setCharacterPalette(agentId, palette)` method              |
| `webview-ui/src/office/components/OfficeCanvas.tsx`  | Add `onAgentContextMenu` prop; update `handleContextMenu`       |
| `webview-ui/src/office/components/VariantPicker.tsx` | **New** — floating panel with sprite thumbnails                 |
| `webview-ui/src/App.tsx`                             | Add context menu + picker state; wire props; render portals     |
| `webview-ui/src/hooks/useExtensionMessages.ts`       | Handle `agentPaletteChanged`                                    |
| `src/PixelAgentsViewProvider.ts`                     | Handle `setAgentPalette`; broadcast `agentPaletteChanged`       |
| `webview-ui/test/variantPicker.test.ts`              | **New** — tests for `getLoadedCharacterCount` + sprite behavior |

---

## Task 1: Tests + `setCharacterPalette` in `OfficeState`

**Files:**

- Modify: `webview-ui/src/office/engine/officeState.ts` (after line ~758, after `setAgentTokens`)
- Create: `webview-ui/test/variantPicker.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `webview-ui/test/variantPicker.test.ts`:

```typescript
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getCharacterSprites,
  getLoadedCharacterCount,
  setCharacterTemplates,
} from '../src/office/sprites/spriteData.ts';
import { Direction } from '../src/office/types.ts';

const makeFrame = (color: string): string[][] => [
  [color, color],
  [color, color],
];
const makeLoadedChar = (color: string) => ({
  down: [makeFrame(color)],
  up: [makeFrame(color)],
  right: [makeFrame(color)],
});

test('getLoadedCharacterCount returns loaded variant count after setCharacterTemplates', () => {
  setCharacterTemplates([
    makeLoadedChar('#ff0000'),
    makeLoadedChar('#00ff00'),
    makeLoadedChar('#0000ff'),
  ]);
  assert.equal(getLoadedCharacterCount(), 3);
});

test('getCharacterSprites returns different walk sprites for different palette indices', () => {
  setCharacterTemplates([makeLoadedChar('#ff0000'), makeLoadedChar('#00ff00')]);
  const s0 = getCharacterSprites(0, 0);
  const s1 = getCharacterSprites(1, 0);
  // Frame 0 of walk DOWN should differ between palettes
  const pixel0 = s0.walk[Direction.DOWN][0][0][0];
  const pixel1 = s1.walk[Direction.DOWN][0][0][0];
  assert.notEqual(pixel0, pixel1, 'different palettes should produce different pixel colors');
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
cd webview-ui && npm test -- --test-name-pattern "getLoadedCharacterCount|getCharacterSprites"
```

Expected: FAIL — `setCharacterTemplates` or `getCharacterSprites` import error, or assertion failure. (If they pass, the infrastructure is already correct and that's fine — continue.)

- [ ] **Step 3: Add `setCharacterPalette` to `officeState.ts`**

In `webview-ui/src/office/engine/officeState.ts`, add this method after `setAgentTokens` (around line 758):

```typescript
setCharacterPalette(agentId: number, palette: number): void {
  const ch = this.characters.get(agentId);
  if (!ch) return;
  ch.palette = palette;
  ch.hueShift = 0;
}
```

- [ ] **Step 4: Run full test suite to confirm passing**

```
cd webview-ui && npm test
```

Expected: all tests pass, including the two new ones.

- [ ] **Step 5: Commit**

```bash
git add webview-ui/src/office/engine/officeState.ts webview-ui/test/variantPicker.test.ts
git commit -m "feat: add setCharacterPalette to OfficeState + variant sprite tests"
```

---

## Task 2: Character hit-test on right-click in `OfficeCanvas`

**Files:**

- Modify: `webview-ui/src/office/components/OfficeCanvas.tsx`

- [ ] **Step 1: Add `onAgentContextMenu` to `OfficeCanvasProps`**

In `webview-ui/src/office/components/OfficeCanvas.tsx`, find `interface OfficeCanvasProps` and add the new prop after `onClick`:

```typescript
interface OfficeCanvasProps {
  officeState: OfficeState;
  onClick: (agentId: number) => void;
  onAgentContextMenu: (agentId: number, screenX: number, screenY: number) => void;
  isEditMode: boolean;
  // ... rest of props unchanged
```

Destructure it in the function signature after `onClick`:

```typescript
export function OfficeCanvas({
  officeState,
  onClick,
  onAgentContextMenu,
  isEditMode,
  // ... rest unchanged
```

- [ ] **Step 2: Replace `handleContextMenu`**

Find the existing `handleContextMenu` callback (around line 748) and replace it entirely:

```typescript
const handleContextMenu = useCallback(
  (e: React.MouseEvent) => {
    e.preventDefault();
    if (isEditMode) return;
    // If right-clicking on a non-sub-agent character, show context menu
    const pos = screenToWorld(e.clientX, e.clientY);
    if (pos) {
      const hitId = officeState.getCharacterAt(pos.worldX, pos.worldY);
      if (hitId !== null && !officeState.characters.get(hitId)?.isSubagent) {
        onAgentContextMenu(hitId, e.clientX, e.clientY);
        return;
      }
    }
    // No character hit — existing walk-to-tile behavior
    if (officeState.selectedAgentId !== null) {
      const tile = screenToTile(e.clientX, e.clientY);
      if (tile) {
        officeState.walkToTile(officeState.selectedAgentId, tile.col, tile.row);
      }
    }
  },
  [isEditMode, officeState, screenToTile, screenToWorld, onAgentContextMenu],
);
```

- [ ] **Step 3: Type-check**

```
cd webview-ui && npx tsc --noEmit
```

Expected: error that `onAgentContextMenu` is missing at the `<OfficeCanvas` call site in `App.tsx`. That's expected — fixed in Task 4.

- [ ] **Step 4: Commit**

```bash
git add webview-ui/src/office/components/OfficeCanvas.tsx
git commit -m "feat: add onAgentContextMenu prop, hit-test character on right-click"
```

---

## Task 3: `VariantPicker` component

**Files:**

- Create: `webview-ui/src/office/components/VariantPicker.tsx`

- [ ] **Step 1: Create the component**

Create `webview-ui/src/office/components/VariantPicker.tsx`:

```typescript
import { useEffect, useRef } from 'react';

import { getCharacterSprites, getLoadedCharacterCount } from '../sprites/spriteData.js';
import type { SpriteData } from '../types.js';
import { Direction } from '../types.js';

interface VariantPickerProps {
  agentId: number;
  currentPalette: number;
  screenX: number;
  screenY: number;
  onPick: (agentId: number, palette: number) => void;
  onClose: () => void;
}

function renderSpriteToDataUrl(sprite: SpriteData, pixelSize: number): string {
  const h = sprite.length;
  const w = sprite[0]?.length ?? 0;
  const canvas = document.createElement('canvas');
  canvas.width = w * pixelSize;
  canvas.height = h * pixelSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const color = sprite[row][col];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(col * pixelSize, row * pixelSize, pixelSize, pixelSize);
    }
  }
  return canvas.toDataURL();
}

export function VariantPicker({
  agentId,
  currentPalette,
  screenX,
  screenY,
  onPick,
  onClose,
}: VariantPickerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const PIXEL_SIZE = 3;
  const count = getLoadedCharacterCount();

  const thumbnails: string[] = [];
  for (let i = 0; i < count; i++) {
    const sprites = getCharacterSprites(i, 0);
    // Frame index 1 = walk2 = standing idle pose, facing down
    const frame = sprites.walk[Direction.DOWN][1];
    thumbnails.push(renderSpriteToDataUrl(frame, PIXEL_SIZE));
  }

  // Clamp to viewport so panel doesn't clip off-screen
  const PANEL_W = 180;
  const PANEL_H = 140;
  const left = Math.min(screenX, window.innerWidth - PANEL_W - 8);
  const top = Math.min(screenY, window.innerHeight - PANEL_H - 8);

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left,
        top,
        background: 'var(--pixel-bg, #1e1e2e)',
        border: '2px solid var(--pixel-border, #444466)',
        boxShadow: '2px 2px 0px #0a0a14',
        borderRadius: 0,
        padding: '8px',
        zIndex: 9999,
        fontFamily: 'var(--pixel-font, monospace)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: '#888',
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        Choose Skin
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: PANEL_W - 16 }}>
        {thumbnails.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`Skin ${i}`}
            style={{
              imageRendering: 'pixelated',
              border: i === currentPalette ? '2px solid #ffffff' : '2px solid transparent',
              cursor: 'pointer',
              background: '#2a2a3e',
            }}
            onClick={() => {
              onPick(agentId, i);
              onClose();
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```
cd webview-ui && npx tsc --noEmit
```

Expected: no new errors from `VariantPicker.tsx` itself (App.tsx still errors on missing prop — OK).

- [ ] **Step 3: Commit**

```bash
git add webview-ui/src/office/components/VariantPicker.tsx
git commit -m "feat: add VariantPicker component with sprite thumbnail grid"
```

---

## Task 4: Wire up context menu + picker in `App.tsx`

**Files:**

- Modify: `webview-ui/src/App.tsx`

- [ ] **Step 1: Add imports**

At the top of `webview-ui/src/App.tsx`, add to the existing import block:

```typescript
import { createPortal } from 'react-dom';
import { VariantPicker } from './office/components/VariantPicker.js';
```

- [ ] **Step 2: Add state**

In `App.tsx` inside `function App()`, after the existing `useState` declarations (e.g., after `const [alwaysShowOverlay, setAlwaysShowOverlay] = useState(false);`):

```typescript
const [agentContextMenu, setAgentContextMenu] = useState<{
  agentId: number;
  screenX: number;
  screenY: number;
} | null>(null);
const [variantPicker, setVariantPicker] = useState<{
  agentId: number;
  currentPalette: number;
  screenX: number;
  screenY: number;
} | null>(null);
const contextMenuRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 3: Add click-outside handler for context menu**

After the existing `useEffect` blocks in `App.tsx`:

```typescript
useEffect(() => {
  if (!agentContextMenu) return;
  const handler = (e: MouseEvent) => {
    if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
      setAgentContextMenu(null);
    }
  };
  document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
}, [agentContextMenu]);
```

- [ ] **Step 4: Add callbacks**

After `handleCloseAgent` in `App.tsx`:

```typescript
const handleAgentContextMenu = useCallback((agentId: number, screenX: number, screenY: number) => {
  setAgentContextMenu({ agentId, screenX, screenY });
}, []);

const handleVariantPick = useCallback((agentId: number, palette: number) => {
  const os = getOfficeState();
  os.setCharacterPalette(agentId, palette);
  vscode.postMessage({ type: 'setAgentPalette', agentId, palette });
}, []);
```

- [ ] **Step 5: Pass `onAgentContextMenu` to `<OfficeCanvas>`**

Find `<OfficeCanvas` in the JSX return and add the new prop:

```typescript
<OfficeCanvas
  officeState={officeState}
  onClick={handleClick}
  onAgentContextMenu={handleAgentContextMenu}
  {/* ... rest of existing props unchanged */}
/>
```

- [ ] **Step 6: Render portals**

At the end of the `App.tsx` return, just before the final closing `</div>`, add:

```typescript
{agentContextMenu !== null &&
  createPortal(
    <div
      ref={contextMenuRef}
      style={{
        position: 'fixed',
        left: agentContextMenu.screenX,
        top: agentContextMenu.screenY,
        background: 'var(--pixel-bg, #1e1e2e)',
        border: '2px solid var(--pixel-border, #444466)',
        boxShadow: '2px 2px 0px #0a0a14',
        borderRadius: 0,
        zIndex: 9998,
        minWidth: 148,
        fontFamily: 'var(--pixel-font, monospace)',
        fontSize: 13,
      }}
    >
      <div
        style={{
          padding: '6px 12px',
          cursor: 'pointer',
          color: 'var(--pixel-accent, #a78bfa)',
          userSelect: 'none',
        }}
        onClick={() => {
          const os = getOfficeState();
          const ch = os.characters.get(agentContextMenu.agentId);
          setVariantPicker({
            agentId: agentContextMenu.agentId,
            currentPalette: ch?.palette ?? 0,
            screenX: agentContextMenu.screenX,
            screenY: agentContextMenu.screenY + 32,
          });
          setAgentContextMenu(null);
        }}
      >
        🎨 Customize Agent
      </div>
    </div>,
    document.body,
  )}
{variantPicker !== null &&
  createPortal(
    <VariantPicker
      agentId={variantPicker.agentId}
      currentPalette={variantPicker.currentPalette}
      screenX={variantPicker.screenX}
      screenY={variantPicker.screenY}
      onPick={handleVariantPick}
      onClose={() => setVariantPicker(null)}
    />,
    document.body,
  )}
```

- [ ] **Step 7: Type-check**

```
cd webview-ui && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add webview-ui/src/App.tsx
git commit -m "feat: wire context menu and VariantPicker portal in App"
```

---

## Task 5: Extension — handle `setAgentPalette`, broadcast `agentPaletteChanged`

**Files:**

- Modify: `src/PixelAgentsViewProvider.ts`

- [ ] **Step 1: Add handler inside `onDidReceiveMessage`**

In `src/PixelAgentsViewProvider.ts`, find the block `} else if (message.type === 'saveAgentSeats') {` and add a new block immediately after it:

```typescript
} else if (message.type === 'setAgentPalette') {
  const agentId = message.agentId as number;
  const palette = message.palette as number;
  // Silently no-op if agent not found (may have closed between click and message)
  if (!this.agents.has(agentId)) return;
  // Update just this agent's entry in the persisted seat/palette record
  const seats = this.context.workspaceState.get<
    Record<string, { palette?: number; hueShift?: number; seatId?: string }>
  >(WORKSPACE_KEY_AGENT_SEATS, {});
  const existing = seats[String(agentId)] ?? {};
  seats[String(agentId)] = { ...existing, palette, hueShift: 0 };
  void this.context.workspaceState.update(WORKSPACE_KEY_AGENT_SEATS, seats);
  // Broadcast to all webview instances (cross-window sync)
  this.webview?.postMessage({ type: 'agentPaletteChanged', agentId, palette });
```

- [ ] **Step 2: Type-check the extension**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/PixelAgentsViewProvider.ts
git commit -m "feat: handle setAgentPalette in extension, persist and broadcast agentPaletteChanged"
```

---

## Task 6: Webview — handle `agentPaletteChanged`

**Files:**

- Modify: `webview-ui/src/hooks/useExtensionMessages.ts`

- [ ] **Step 1: Add handler inside the message event listener**

In `webview-ui/src/hooks/useExtensionMessages.ts`, inside the `handler` function, find the `} else if (msg.type === 'agentClosed') {` block. Add a new block immediately after the closing brace of `agentClosed`:

```typescript
} else if (msg.type === 'agentPaletteChanged') {
  const agentId = msg.agentId as number;
  const palette = msg.palette as number;
  os.setCharacterPalette(agentId, palette);
}
```

- [ ] **Step 2: Full build**

```
npm run build
```

Expected: type-check → lint → esbuild → vite — all pass with no errors.

- [ ] **Step 3: Run full test suite**

```
npm test
```

Expected: all tests pass, including new `variantPicker.test.ts`.

- [ ] **Step 4: Commit**

```bash
git add webview-ui/src/hooks/useExtensionMessages.ts
git commit -m "feat: handle agentPaletteChanged in webview for cross-window palette sync"
```

---

## Task 7: Smoke test + repackage

- [ ] **Step 1: Launch Extension Dev Host**

Press **F5** in VS Code with the `pixel-agents` repo open. The Extension Development Host window opens.

- [ ] **Step 2: Smoke test — golden path**

1. Click **+ Agent** to spawn a character
2. Wait for the character to appear and walk to a seat
3. **Right-click the character** in the canvas
4. Confirm a context menu appears with **"🎨 Customize Agent"**
5. Click **"Customize Agent"**
6. Confirm a floating panel opens near the character showing thumbnail previews of all 6 sprite variants
7. The current variant has a white border highlight
8. Click a **different variant** thumbnail
9. Confirm the character's appearance changes immediately (no reload needed)
10. **Reload the Extension Dev Host window** (Ctrl+Shift+P → "Reload Window")
11. Confirm the character **still has the selected skin** (persistence check)

- [ ] **Step 3: Smoke test — walk-to-tile still works**

1. Click a character (select it — white outline appears)
2. **Right-click an empty floor tile** (not on any character)
3. Confirm the character walks to that tile (existing behavior preserved)

- [ ] **Step 4: Smoke test — sub-agents are excluded**

1. If a sub-agent character is visible (spawned by a Task tool call), right-click it
2. Confirm the context menu does **not** appear — it should fall through to walk-to-tile behavior

- [ ] **Step 5: Repackage VSIX**

```
npx vsce package
```

Expected: `pixel-agents-1.3.0.vsix` rebuilt successfully.

- [ ] **Step 6: Final commit**

```bash
git add pixel-agents-1.3.0.vsix
git commit -m "chore: repackage vsix with custom agent appearance feature"
```

- [ ] **Step 7: Merge to main**

```bash
git checkout main
git merge feat/custom-agent-appearance
git push
```
