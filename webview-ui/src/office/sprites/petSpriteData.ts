import type { PetDirectionSprites } from '../../../../shared/assets/types.js';
import type { SpriteData } from '../types.js';
import { Direction } from '../types.js';

function flipHorizontal(sprite: SpriteData): SpriteData {
  return sprite.map((row) => [...row].reverse());
}

type PetSpritesByDirection = Record<Direction, SpriteData[]>;

const petSprites = new Map<string, PetSpritesByDirection>();

export interface PetSpriteInput {
  speciesId: string;
  frames: PetDirectionSprites;
}

export function setPetSprites(data: PetSpriteInput[]): void {
  petSprites.clear();
  for (const { speciesId, frames } of data) {
    petSprites.set(speciesId, {
      [Direction.DOWN]: frames.down,
      [Direction.UP]: frames.up,
      [Direction.LEFT]: frames.right,
      [Direction.RIGHT]: frames.right.map(flipHorizontal),
    });
  }
}

export function getPetSprites(speciesId: string): PetSpritesByDirection | null {
  return petSprites.get(speciesId) ?? null;
}

export function getPetSprite(speciesId: string, dir: Direction, frame: number): SpriteData | null {
  const byDir = petSprites.get(speciesId);
  if (!byDir) return null;
  const frames = byDir[dir];
  if (!frames || frames.length === 0) return null;
  return frames[frame % frames.length];
}

export function getLoadedPetSpecies(): string[] {
  return Array.from(petSprites.keys());
}

const petAnimSprites = new Map<string, Map<string, PetSpritesByDirection>>();

export interface PetAnimSpriteInput {
  speciesId: string;
  animName: string;
  frames: PetDirectionSprites;
}

export function setPetAnimSprites(data: PetAnimSpriteInput[]): void {
  for (const { speciesId, animName, frames } of data) {
    let byAnim = petAnimSprites.get(speciesId);
    if (!byAnim) {
      byAnim = new Map();
      petAnimSprites.set(speciesId, byAnim);
    }
    byAnim.set(animName, {
      [Direction.DOWN]: frames.down,
      [Direction.UP]: frames.up,
      [Direction.LEFT]: frames.right.map(flipHorizontal),
      [Direction.RIGHT]: frames.right,
    });
  }
}

export function getPetAnimSprite(
  speciesId: string,
  animName: string,
  dir: Direction,
  frame: number,
): SpriteData | null {
  const byDir = petAnimSprites.get(speciesId)?.get(animName);
  if (!byDir) return null;
  const frames = byDir[dir];
  if (!frames || frames.length === 0) return null;
  return frames[frame % frames.length];
}

export function getLoadedPetAnims(speciesId: string): string[] {
  return Array.from(petAnimSprites.get(speciesId)?.keys() ?? []);
}

export function getPetAnimFrames(speciesId: string, animName: string): SpriteData[] | null {
  return petAnimSprites.get(speciesId)?.get(animName)?.[Direction.DOWN] ?? null;
}
