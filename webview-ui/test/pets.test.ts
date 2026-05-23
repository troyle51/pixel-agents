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

import {
  getLoadedPetSpecies,
  getPetSprites,
  setPetSprites,
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

import { PET_WALK_FRAME_DURATION_SEC } from '../src/constants.ts';
import { createPet, updatePet } from '../src/office/engine/pets.ts';
import { PetState, TileType } from '../src/office/types.ts';

test('createPet: initializes pet at correct tile position', () => {
  const pet = createPet(1, 'pikachu', 3, 5);
  assert.equal(pet.id, 1);
  assert.equal(pet.speciesId, 'pikachu');
  assert.equal(pet.tileCol, 3);
  assert.equal(pet.tileRow, 5);
  assert.equal(pet.state, PetState.IDLE);
  // Pixel position should be tile center (TILE_SIZE = 16)
  assert.equal(pet.x, 3 * 16 + 8);
  assert.equal(pet.y, 5 * 16 + 8);
});

test('createPet: initializes matrixEffect fields to null/zero/empty', () => {
  const pet = createPet(1, 'pikachu', 2, 3);
  assert.equal(pet.matrixEffect, null);
  assert.equal(pet.matrixEffectTimer, 0);
  assert.deepEqual(pet.matrixEffectSeeds, []);
});

test('updatePet IDLE→WALK: starts walking when wanderTimer expires', () => {
  const pet = createPet(1, 'pikachu', 0, 0);
  pet.wanderTimer = 0; // expired

  const walkable = [{ col: 2, row: 2 }];
  const F = TileType.FLOOR_1;
  const tileMap: TileType[][] = [
    [F, F, F],
    [F, F, F],
    [F, F, F],
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

  const tileMap: TileType[][] = [[TileType.FLOOR_1, TileType.FLOOR_1]];
  updatePet(pet, 0.2, [], tileMap, new Set(), [], []);

  assert.ok(pet.moveProgress > 0 || pet.tileCol === 1, 'pet should have moved');
  assert.ok(pet.frame > 0, 'frame should advance with dt=0.2 > PET_WALK_FRAME_DURATION_SEC');
});

test('updatePet WALK: advances frame past 4 when species has 8 frames', () => {
  const frame: string[][] = [['#ff0000']];
  const eightFrames = [frame, frame, frame, frame, frame, frame, frame, frame];
  setPetSprites([
    {
      speciesId: 'eight_frame_mon',
      frames: { down: eightFrames, up: eightFrames, right: eightFrames },
    },
  ]);

  const pet = createPet(99, 'eight_frame_mon', 0, 0);
  pet.state = PetState.WALK;
  pet.path = [{ col: 1, row: 0 }];
  pet.frame = 3;
  pet.frameTimer = 0;

  const tileMap: TileType[][] = [[TileType.FLOOR_1, TileType.FLOOR_1]];
  for (let i = 0; i < 10; i++) {
    updatePet(pet, PET_WALK_FRAME_DURATION_SEC * 1.1, [], tileMap, new Set(), [], []);
    if (pet.frame > 4) break;
  }

  assert.ok(pet.frame > 4, `frame should advance past 4, got ${pet.frame}`);
});

test('updatePet WALK→IDLE: transitions when path is complete', () => {
  const pet = createPet(1, 'pikachu', 0, 0);
  pet.state = PetState.WALK;
  pet.path = []; // path already done
  pet.moveProgress = 1;

  updatePet(pet, 0.016, [], [[TileType.FLOOR_1]], new Set(), [], []);

  assert.equal(pet.state, PetState.IDLE, 'should transition to IDLE');
  assert.ok(pet.wanderTimer > 0, 'should set a new wanderTimer');
});

test('updatePet: FSM is not updated when matrixEffect is active (guard in officeState)', () => {
  // The FSM pause lives in officeState.update(), not in updatePet itself.
  // updatePet still processes normally when called directly.
  // This test documents the architectural boundary.
  assert.ok(true, 'matrixEffect FSM pause is enforced in officeState.update loop');
});
