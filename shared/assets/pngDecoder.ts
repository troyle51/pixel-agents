/**
 * Pure PNG decoding utilities — shared between the extension host, Vite build
 * scripts, and future standalone backend.
 *
 * No VS Code dependency. Only uses pngjs and shared constants.
 */

import { PNG } from 'pngjs';

import { rgbaToHex } from './colorUtils.js';
import {
  CHAR_FRAME_H,
  CHAR_FRAME_W,
  CHAR_FRAMES_PER_ROW,
  CHARACTER_DIRECTIONS,
  FLOOR_TILE_SIZE,
  PET_DIRECTIONS,
  WALL_BITMASK_COUNT,
  WALL_GRID_COLS,
  WALL_PIECE_HEIGHT,
  WALL_PIECE_WIDTH,
} from './constants.js';
import type { CharacterDirectionSprites, PetDirectionSprites } from './types.js';

// ── Sprite decoding ──────────────────────────────────────────

/**
 * Convert a PNG buffer to SpriteData (2D array of hex color strings).
 * '' = transparent, '#RRGGBB' = opaque, '#RRGGBBAA' = semi-transparent.
 */
export function pngToSpriteData(pngBuffer: Buffer, width: number, height: number): string[][] {
  try {
    const png = PNG.sync.read(pngBuffer);

    if (png.width !== width || png.height !== height) {
      console.warn(
        `PNG dimensions mismatch: expected ${width}×${height}, got ${png.width}×${png.height}`,
      );
    }

    const sprite: string[][] = [];
    const data = png.data;

    for (let y = 0; y < height; y++) {
      const row: string[] = [];
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * png.width + x) * 4;
        const r = data[pixelIndex];
        const g = data[pixelIndex + 1];
        const b = data[pixelIndex + 2];
        const a = data[pixelIndex + 3];
        row.push(rgbaToHex(r, g, b, a));
      }
      sprite.push(row);
    }

    return sprite;
  } catch (err) {
    console.warn(`Failed to parse PNG: ${err instanceof Error ? err.message : err}`);
    const sprite: string[][] = [];
    for (let y = 0; y < height; y++) {
      sprite.push(new Array(width).fill(''));
    }
    return sprite;
  }
}

/**
 * Parse a single wall PNG (64×128, 4×4 grid of 16×32 pieces) into 16 bitmask sprites.
 * Piece at bitmask M: col = M % 4, row = floor(M / 4).
 */
export function parseWallPng(pngBuffer: Buffer): string[][][] {
  const png = PNG.sync.read(pngBuffer);
  const sprites: string[][][] = [];
  for (let mask = 0; mask < WALL_BITMASK_COUNT; mask++) {
    const ox = (mask % WALL_GRID_COLS) * WALL_PIECE_WIDTH;
    const oy = Math.floor(mask / WALL_GRID_COLS) * WALL_PIECE_HEIGHT;
    const sprite: string[][] = [];
    for (let r = 0; r < WALL_PIECE_HEIGHT; r++) {
      const row: string[] = [];
      for (let c = 0; c < WALL_PIECE_WIDTH; c++) {
        const idx = ((oy + r) * png.width + (ox + c)) * 4;
        const rv = png.data[idx];
        const gv = png.data[idx + 1];
        const bv = png.data[idx + 2];
        const av = png.data[idx + 3];
        row.push(rgbaToHex(rv, gv, bv, av));
      }
      sprite.push(row);
    }
    sprites.push(sprite);
  }
  return sprites;
}

/**
 * Decode a single character PNG into direction-keyed frame arrays.
 * Each PNG has 3 direction rows (down, up, right) × CHAR_FRAMES_PER_ROW frames (16×32 each).
 *
 * If the PNG is narrower than CHAR_FRAMES_PER_ROW * CHAR_FRAME_W (e.g. an older 7-frame
 * PNG when the constant has been bumped to 9), frames whose start offset falls outside the
 * PNG width are returned as empty (all-transparent) SpriteData so the decoder never reads
 * out-of-bounds pixel data.
 */
export function decodeCharacterPng(pngBuffer: Buffer): CharacterDirectionSprites {
  const png = PNG.sync.read(pngBuffer);
  const charData: CharacterDirectionSprites = { down: [], up: [], right: [] };

  for (let dirIdx = 0; dirIdx < CHARACTER_DIRECTIONS.length; dirIdx++) {
    const dir = CHARACTER_DIRECTIONS[dirIdx];
    const rowOffsetY = dirIdx * CHAR_FRAME_H;
    const frames: string[][][] = [];

    for (let f = 0; f < CHAR_FRAMES_PER_ROW; f++) {
      const frameOffsetX = f * CHAR_FRAME_W;

      // Frame is outside the PNG — return an empty (all-transparent) frame.
      if (frameOffsetX >= png.width) {
        const emptyFrame: string[][] = [];
        for (let y = 0; y < CHAR_FRAME_H; y++) {
          emptyFrame.push(new Array<string>(CHAR_FRAME_W).fill(''));
        }
        frames.push(emptyFrame);
        continue;
      }

      const sprite: string[][] = [];
      for (let y = 0; y < CHAR_FRAME_H; y++) {
        const row: string[] = [];
        for (let x = 0; x < CHAR_FRAME_W; x++) {
          const idx = ((rowOffsetY + y) * png.width + (frameOffsetX + x)) * 4;
          const r = png.data[idx];
          const g = png.data[idx + 1];
          const b = png.data[idx + 2];
          const a = png.data[idx + 3];
          row.push(rgbaToHex(r, g, b, a));
        }
        sprite.push(row);
      }
      frames.push(sprite);
    }
    charData[dir] = frames;
  }

  return charData;
}

/**
 * Decode a single floor tile PNG (16×16 grayscale pattern).
 */
export function decodeFloorPng(pngBuffer: Buffer): string[][] {
  return pngToSpriteData(pngBuffer, FLOOR_TILE_SIZE, FLOOR_TILE_SIZE);
}

/**
 * Decode a pet sprite PNG into direction-keyed frame arrays.
 * Layout: 3 rows (down, up, right) × N square frames.
 * Frame size is inferred: frameSize = imageHeight / PET_DIRECTIONS.length.
 * Frame count = imageWidth / frameSize.
 */
export function decodePetPng(pngBuffer: Buffer): PetDirectionSprites {
  const png = PNG.sync.read(pngBuffer);
  const frameSize = Math.floor(png.height / PET_DIRECTIONS.length);
  const frameCount = frameSize > 0 ? Math.floor(png.width / frameSize) : 0;

  const result: PetDirectionSprites = { down: [], up: [], right: [] };

  for (let dirIdx = 0; dirIdx < PET_DIRECTIONS.length; dirIdx++) {
    const dirKey = PET_DIRECTIONS[dirIdx];
    const rowOffsetY = dirIdx * frameSize;
    const frames: string[][][] = [];

    for (let f = 0; f < frameCount; f++) {
      const frameOffsetX = f * frameSize;
      const sprite: string[][] = [];
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
