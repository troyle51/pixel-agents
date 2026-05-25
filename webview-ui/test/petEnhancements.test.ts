import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OfficeState } from '../src/office/engine/officeState.js';
import { Direction, PetState } from '../src/office/types.js';

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
    matrixEffect: null as null | 'spawn' | 'despawn',
    matrixEffectTimer: 0,
    matrixEffectSeeds: [],
    emoteAnim: null as null | string,
    emoteTimer: 0,
    restTimer: 0,
    bondedAgentId: null as null | number,
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

test('setAgentActive scatters nearby pets — resets wanderTimer and clears path', () => {
  const os = new OfficeState();
  // Insert a character at tile (5,5) → world center (88, 88)
  os.characters.set(1, {
    id: 1,
    palette: 0,
    hueShift: 0,
    isActive: false,
    isSubagent: false,
    state: 'idle' as const,
    dir: 'down' as const,
    x: 88,
    y: 88,
    tileCol: 5,
    tileRow: 5,
    path: [],
    moveProgress: 0,
    targetCol: 5,
    targetRow: 5,
    frame: 0,
    frameTimer: 0,
    wanderTimer: 5,
    wanderCount: 0,
    wanderLimit: 6,
    seatId: null,
    bubble: null,
    bubbleTimer: 0,
    activitySessionId: null,
    matrixEffect: null,
    matrixEffectTimer: 0,
    matrixEffectSeeds: [],
    toolName: null,
    isTyping: false,
  } as any);

  // Pet 3 tiles away at tile (8,5) → world (136, 88) — within scatter radius (4)
  const nearPet = makePet(10, 136, 88);
  nearPet.wanderTimer = 5;
  nearPet.path = [{ col: 9, row: 5 }];
  os.pets.set(10, nearPet);

  // Pet 10 tiles away at tile (15,5) → world (248, 88) — outside radius
  const farPet = makePet(11, 248, 88);
  farPet.wanderTimer = 5;
  os.pets.set(11, farPet);

  os.setAgentActive(1, true);

  assert.equal(os.pets.get(10)!.wanderTimer, 0); // near pet scattered
  assert.deepEqual(os.pets.get(10)!.path, []); // path cleared
  assert.equal(os.pets.get(11)!.wanderTimer, 5); // far pet unchanged
});
