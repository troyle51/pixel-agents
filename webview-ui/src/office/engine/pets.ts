import {
  PET_APPROACH_AGENT_CHANCE,
  PET_APPROACH_FURNITURE_CHANCE,
  PET_APPROACH_RADIUS_TILES,
  PET_BOND_BREAK_CHANCE,
  PET_BOND_CHANCE,
  PET_EMOTE_FRAME_DURATION_SEC,
  PET_REST_CHANCE,
  PET_REST_MAX_SEC,
  PET_REST_MIN_SEC,
  PET_WALK_FRAME_DURATION_SEC,
  PET_WALK_SPEED_PX_PER_SEC,
  PET_WANDER_PAUSE_MAX_SEC,
  PET_WANDER_PAUSE_MIN_SEC,
} from '../../constants.js';
import { findPath } from '../layout/tileMap.js';
import { getPetAnimFrames, getPetSprites } from '../sprites/petSpriteData.js';
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
    matrixEffect: null,
    matrixEffectTimer: 0,
    matrixEffectSeeds: [],
    emoteAnim: null,
    emoteTimer: 0,
    restTimer: 0,
    bondedAgentId: null,
  };
}

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

      // Chance to bond with a nearby idle character
      if (Math.random() < PET_BOND_CHANCE && characters.length > 0) {
        const idleChars = characters.filter((c) => !c.isActive && !c.isSubagent);
        const inRadius = idleChars.filter(
          (c) =>
            Math.abs(c.tileCol - pet.tileCol) + Math.abs(c.tileRow - pet.tileRow) <=
            PET_APPROACH_RADIUS_TILES * 2,
        );
        if (inRadius.length > 0) {
          const bondTarget = inRadius[Math.floor(Math.random() * inRadius.length)];
          pet.bondedAgentId = bondTarget.id;
          pet.state = PetState.BONDED;
          pet.wanderTimer = randomRange(PET_WANDER_PAUSE_MIN_SEC, PET_WANDER_PAUSE_MAX_SEC);
          break;
        }
      }

      // Chance to rest near furniture
      if (Math.random() < PET_REST_CHANCE && furniture.length > 0) {
        const f = furniture[Math.floor(Math.random() * furniture.length)];
        const nearby = nearbyWalkable(f.col, f.row, 1, walkableTiles);
        if (nearby.length > 0) {
          const restTile = nearby[Math.floor(Math.random() * nearby.length)];
          const path = findPath(
            pet.tileCol,
            pet.tileRow,
            restTile.col,
            restTile.row,
            tileMap,
            blockedTiles,
          );
          if (path.length > 0) {
            pet.path = path;
            pet.moveProgress = 0;
            pet.restTimer = randomRange(PET_REST_MIN_SEC, PET_REST_MAX_SEC);
            pet.state = PetState.WALK;
            pet.frame = 0;
            pet.frameTimer = 0;
            break;
          }
        }
      }

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
          if (nearby.length > 0) target = nearby[Math.floor(Math.random() * nearby.length)];
        }
      }

      if (
        !target &&
        roll < PET_APPROACH_AGENT_CHANCE + PET_APPROACH_FURNITURE_CHANCE &&
        furniture.length > 0 &&
        getCatalog
      ) {
        const activityFurniture = furniture.filter((f) => getCatalog(f.type)?.activityId != null);
        if (activityFurniture.length > 0) {
          const f = activityFurniture[Math.floor(Math.random() * activityFurniture.length)];
          const nearby = nearbyWalkable(f.col, f.row, PET_APPROACH_RADIUS_TILES, walkableTiles);
          if (nearby.length > 0) target = nearby[Math.floor(Math.random() * nearby.length)];
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
        pet.wanderTimer = randomRange(PET_WANDER_PAUSE_MIN_SEC, PET_WANDER_PAUSE_MAX_SEC);
      }
      break;
    }

    case PetState.WALK: {
      pet.frameTimer += dt;
      if (pet.frameTimer >= PET_WALK_FRAME_DURATION_SEC) {
        pet.frameTimer -= PET_WALK_FRAME_DURATION_SEC;
        const frameCount = getPetSprites(pet.speciesId)?.[pet.dir]?.length ?? 4;
        pet.frame = (pet.frame + 1) % frameCount;
      }

      if (pet.path.length === 0) {
        const center = tileCenter(pet.tileCol, pet.tileRow);
        pet.x = center.x;
        pet.y = center.y;
        if (pet.restTimer > 0) {
          pet.state = PetState.RESTING;
        } else {
          pet.state = PetState.IDLE;
          pet.wanderTimer = randomRange(PET_WANDER_PAUSE_MIN_SEC, PET_WANDER_PAUSE_MAX_SEC);
        }
        pet.frame = 0;
        pet.frameTimer = 0;
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

    case PetState.RESTING: {
      pet.restTimer -= dt;
      if (pet.restTimer <= 0) {
        pet.state = PetState.IDLE;
        pet.wanderTimer = randomRange(PET_WANDER_PAUSE_MIN_SEC, PET_WANDER_PAUSE_MAX_SEC);
      }
      break;
    }

    case PetState.EMOTING: {
      if (!pet.emoteAnim) {
        pet.state = PetState.IDLE;
        pet.wanderTimer = randomRange(PET_WANDER_PAUSE_MIN_SEC, PET_WANDER_PAUSE_MAX_SEC);
        break;
      }
      pet.frameTimer += dt;
      if (pet.frameTimer >= PET_EMOTE_FRAME_DURATION_SEC) {
        pet.frameTimer -= PET_EMOTE_FRAME_DURATION_SEC;
        pet.frame++;
        const totalFrames = getPetAnimFrames(pet.speciesId, pet.emoteAnim)?.length ?? 4;
        if (pet.frame >= totalFrames) {
          pet.state = PetState.IDLE;
          pet.emoteAnim = null;
          pet.frame = 0;
          pet.wanderTimer = randomRange(PET_WANDER_PAUSE_MIN_SEC, PET_WANDER_PAUSE_MAX_SEC);
        }
      }
      break;
    }

    case PetState.BONDED: {
      pet.wanderTimer -= dt;

      // Break bond if agent no longer exists or randomly
      const bondedChar = characters.find((c) => c.id === pet.bondedAgentId);
      if (!bondedChar || Math.random() < PET_BOND_BREAK_CHANCE) {
        pet.bondedAgentId = null;
        pet.state = PetState.IDLE;
        pet.wanderTimer = randomRange(PET_WANDER_PAUSE_MIN_SEC, PET_WANDER_PAUSE_MAX_SEC);
        break;
      }

      if (pet.wanderTimer > 0) break;

      // Pathfind to a tile near the bonded agent
      const nearby = nearbyWalkable(
        bondedChar.tileCol,
        bondedChar.tileRow,
        PET_APPROACH_RADIUS_TILES,
        walkableTiles,
      );
      const target = nearby.length > 0 ? nearby[Math.floor(Math.random() * nearby.length)] : null;
      if (target) {
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
        }
      }
      pet.wanderTimer = randomRange(PET_WANDER_PAUSE_MIN_SEC, PET_WANDER_PAUSE_MAX_SEC);
      break;
    }
  }
}
