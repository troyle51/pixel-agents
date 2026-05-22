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
