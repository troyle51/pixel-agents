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
  setPetSprites,
  getPetSprites,
  getLoadedPetSpecies,
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
