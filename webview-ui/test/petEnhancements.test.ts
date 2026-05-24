import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OfficeState } from '../src/office/engine/officeState.js';
import { PetState } from '../src/office/types.js';
import { Direction } from '../src/office/types.js';

function makePet(id: number, x: number, y: number) {
  return {
    id,
    speciesId: 'pikachu',
    state: PetState.IDLE,
    dir: Direction.DOWN,
    x,
    y,
    tileCol: Math.floor(x / 16),
    tileRow: Math.floor(y / 16),
    path: [],
    moveProgress: 0,
    frame: 0,
    frameTimer: 0,
    wanderTimer: 2,
    matrixEffect: null as null,
    matrixEffectTimer: 0,
    matrixEffectSeeds: [],
    emoteAnim: null as null,
    emoteTimer: 0,
    restTimer: 0,
    bondedAgentId: null as null,
  };
}

test('getPetAt returns petId when coords are inside hit box', () => {
  const os = new OfficeState();
  os.pets.set(1, makePet(1, 100, 100));
  // Box: x ∈ [92, 108], y ∈ [84, 100]
  assert.equal(os.getPetAt(100, 95), 1);
  assert.equal(os.getPetAt(92, 84), 1);
  assert.equal(os.getPetAt(109, 100), null); // just outside right
  assert.equal(os.getPetAt(100, 83), null); // just above
});

test('getPetAt returns null for despawning pets', () => {
  const os = new OfficeState();
  const pet = makePet(2, 50, 50);
  pet.matrixEffect = 'despawn';
  os.pets.set(2, pet);
  assert.equal(os.getPetAt(50, 45), null);
});
