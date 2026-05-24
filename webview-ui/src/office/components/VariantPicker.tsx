import { useEffect, useRef } from 'react';

import {
  VARIANT_PICKER_LABEL_COLOR,
  VARIANT_PICKER_PANEL_H,
  VARIANT_PICKER_PANEL_W,
  VARIANT_PICKER_PIXEL_SIZE,
  VARIANT_PICKER_SELECTED_BORDER,
  VARIANT_PICKER_THUMB_BG,
} from '../../constants.js';
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

  const count = getLoadedCharacterCount();

  const thumbnails: string[] = [];
  for (let i = 0; i < count; i++) {
    const sprites = getCharacterSprites(i, 0);
    // Frame index 1 = walk2 = standing idle pose, facing down
    const frame = sprites.walk[Direction.DOWN][1];
    thumbnails.push(renderSpriteToDataUrl(frame, VARIANT_PICKER_PIXEL_SIZE));
  }

  // Clamp to viewport so panel doesn't clip off-screen
  const left = Math.min(screenX, window.innerWidth - VARIANT_PICKER_PANEL_W - 8);
  const top = Math.min(screenY, window.innerHeight - VARIANT_PICKER_PANEL_H - 8);

  return (
    <div
      ref={panelRef}
      className="pixel-panel"
      style={{
        position: 'fixed',
        left,
        top,
        padding: '8px',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: VARIANT_PICKER_LABEL_COLOR,
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        Choose Skin
      </div>
      <div
        style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: VARIANT_PICKER_PANEL_W - 16 }}
      >
        {thumbnails.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`Skin ${i}`}
            style={{
              imageRendering: 'pixelated',
              border:
                i === currentPalette
                  ? `2px solid ${VARIANT_PICKER_SELECTED_BORDER}`
                  : '2px solid transparent',
              cursor: 'pointer',
              background: VARIANT_PICKER_THUMB_BG,
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
