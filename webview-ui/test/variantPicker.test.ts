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
