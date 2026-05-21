import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ActivityManager } from '../src/office/engine/activityManager.js';
import { CharacterState, Direction } from '../src/office/types.js';
import type { Character, FurnitureCatalogEntry, PlacedFurniture } from '../src/office/types.js';

function makeChar(id: number): Character {
  return {
    id,
    state: CharacterState.IDLE,
    dir: Direction.DOWN,
    x: 0,
    y: 0,
    tileCol: 0,
    tileRow: 0,
    path: [],
    moveProgress: 0,
    currentTool: null,
    palette: 0,
    hueShift: 0,
    frame: 0,
    frameTimer: 0,
    wanderTimer: 0,
    wanderCount: 0,
    wanderLimit: 3,
    isActive: false,
    seatId: null,
    bubbleType: null,
    bubbleTimer: 0,
    seatTimer: 0,
    isSubagent: false,
    parentAgentId: null,
    matrixEffect: null,
    matrixEffectTimer: 0,
    matrixEffectSeeds: [],
    inputTokens: 0,
    outputTokens: 0,
    activitySessionId: null,
  };
}

function ppFurniture(): { pf: PlacedFurniture; entry: FurnitureCatalogEntry } {
  const pf: PlacedFurniture = { uid: 'pp1', type: 'PING_PONG_TABLE', col: 5, row: 5 };
  const entry: FurnitureCatalogEntry = {
    type: 'PING_PONG_TABLE',
    label: 'Ping Pong Table',
    footprintW: 2,
    footprintH: 1,
    sprite: [],
    isDesk: false,
    activityId: 'ping_pong',
    activityMinPlayers: 2,
    activitySlots: [
      { offsetCol: -1, offsetRow: 0, facingDir: 'right' },
      { offsetCol: 2, offsetRow: 0, facingDir: 'left' },
    ],
  };
  return { pf, entry };
}

function coffeeFurniture(): { pf: PlacedFurniture; entry: FurnitureCatalogEntry } {
  const pf: PlacedFurniture = { uid: 'cf1', type: 'COFFEE_MACHINE', col: 2, row: 2 };
  const entry: FurnitureCatalogEntry = {
    type: 'COFFEE_MACHINE',
    label: 'Coffee Machine',
    footprintW: 1,
    footprintH: 1,
    sprite: [],
    isDesk: false,
    activityId: 'coffee',
    activityMinPlayers: 1,
    activitySlots: [{ offsetCol: 0, offsetRow: 1, facingDir: 'up' }],
  };
  return { pf, entry };
}

test('tryJoin reserves a slot and sets activitySessionId', () => {
  const mgr = new ActivityManager();
  const ch = makeChar(1);
  const { pf, entry } = ppFurniture();
  const getCatalog = (t: string) => (t === 'PING_PONG_TABLE' ? entry : null);
  const chars = new Map([[1, ch]]);

  const result = mgr.tryJoin(ch, [pf], getCatalog, chars);

  assert.ok(result !== null);
  assert.equal(ch.activitySessionId, 'pp1');
  assert.equal(result.session.slots[0].participantId, 1);
  assert.equal(result.session.phase, 'waiting');
});

test('tryJoin returns null when all slots occupied', () => {
  const mgr = new ActivityManager();
  const ch1 = makeChar(1);
  const ch2 = makeChar(2);
  const ch3 = makeChar(3);
  const { pf, entry } = ppFurniture();
  const getCatalog = (t: string) => (t === 'PING_PONG_TABLE' ? entry : null);
  const chars = new Map([
    [1, ch1],
    [2, ch2],
    [3, ch3],
  ]);

  mgr.tryJoin(ch1, [pf], getCatalog, chars);
  mgr.tryJoin(ch2, [pf], getCatalog, chars);
  const result = mgr.tryJoin(ch3, [pf], getCatalog, chars);

  assert.equal(result, null);
  assert.equal(ch3.activitySessionId, null);
});

test('arrive flips session to active when minPlayers met', () => {
  const mgr = new ActivityManager();
  const ch1 = makeChar(1);
  const ch2 = makeChar(2);
  const { pf, entry } = ppFurniture();
  const getCatalog = (t: string) => (t === 'PING_PONG_TABLE' ? entry : null);
  const chars = new Map([
    [1, ch1],
    [2, ch2],
  ]);

  mgr.tryJoin(ch1, [pf], getCatalog, chars);
  mgr.tryJoin(ch2, [pf], getCatalog, chars);

  ch1.state = CharacterState.ACTIVITY;
  ch2.state = CharacterState.ACTIVITY;
  mgr.arrive(ch1);
  assert.equal(mgr.getSessions().get('pp1')!.phase, 'waiting');
  mgr.arrive(ch2);
  assert.equal(mgr.getSessions().get('pp1')!.phase, 'active');
});

test('arrive on solo activity immediately goes active', () => {
  const mgr = new ActivityManager();
  const ch = makeChar(1);
  const { pf, entry } = coffeeFurniture();
  const getCatalog = (t: string) => (t === 'COFFEE_MACHINE' ? entry : null);
  const chars = new Map([[1, ch]]);

  mgr.tryJoin(ch, [pf], getCatalog, chars);
  ch.state = CharacterState.ACTIVITY;
  mgr.arrive(ch);

  assert.equal(mgr.getSessions().get('cf1')!.phase, 'active');
});

test('leave resets character state and evicts co-players for multi-player activity', () => {
  const mgr = new ActivityManager();
  const ch1 = makeChar(1);
  const ch2 = makeChar(2);
  const { pf, entry } = ppFurniture();
  const getCatalog = (t: string) => (t === 'PING_PONG_TABLE' ? entry : null);
  const chars = new Map([
    [1, ch1],
    [2, ch2],
  ]);

  mgr.tryJoin(ch1, [pf], getCatalog, chars);
  mgr.tryJoin(ch2, [pf], getCatalog, chars);
  ch1.state = CharacterState.ACTIVITY;
  ch2.state = CharacterState.ACTIVITY;
  mgr.arrive(ch1);
  mgr.arrive(ch2);

  mgr.leave(ch1, chars);

  assert.equal(ch1.state, CharacterState.IDLE);
  assert.equal(ch2.state, CharacterState.IDLE);
  assert.equal(ch1.activitySessionId, null);
  assert.equal(ch2.activitySessionId, null);
  assert.equal(mgr.getSessions().size, 0);
});

test('leave on solo activity removes session', () => {
  const mgr = new ActivityManager();
  const ch = makeChar(1);
  const { pf, entry } = coffeeFurniture();
  const getCatalog = (t: string) => (t === 'COFFEE_MACHINE' ? entry : null);
  const chars = new Map([[1, ch]]);

  mgr.tryJoin(ch, [pf], getCatalog, chars);
  ch.state = CharacterState.ACTIVITY;
  mgr.arrive(ch);
  mgr.leave(ch, chars);

  assert.equal(ch.state, CharacterState.IDLE);
  assert.equal(mgr.getSessions().size, 0);
});

test('ping_pong: ballT advances and bounces between 0 and 1', () => {
  const mgr = new ActivityManager();
  const ch1 = makeChar(1);
  const ch2 = makeChar(2);
  const { pf, entry } = ppFurniture();
  const getCatalog = (t: string) => (t === 'PING_PONG_TABLE' ? entry : null);
  const chars = new Map([
    [1, ch1],
    [2, ch2],
  ]);

  mgr.tryJoin(ch1, [pf], getCatalog, chars);
  mgr.tryJoin(ch2, [pf], getCatalog, chars);
  ch1.state = CharacterState.ACTIVITY;
  ch2.state = CharacterState.ACTIVITY;
  mgr.arrive(ch1);
  mgr.arrive(ch2);

  const session = mgr.getSessions().get('pp1')!;
  assert.equal(session.ballDir, 1);

  // Advance until ball reaches right end
  for (let i = 0; i < 200; i++) mgr.update(0.05, chars);
  assert.ok(session.ballT >= 0 && session.ballT <= 1, `ballT out of range: ${session.ballT}`);
  // Ball should have bounced — direction flips
  assert.equal(session.ballDir, -1);
});

test('ping_pong: left player gets swing frame when ball near their end', () => {
  const mgr = new ActivityManager();
  const ch1 = makeChar(1);
  const ch2 = makeChar(2);
  const { pf, entry } = ppFurniture();
  const getCatalog = (t: string) => (t === 'PING_PONG_TABLE' ? entry : null);
  const chars = new Map([
    [1, ch1],
    [2, ch2],
  ]);

  mgr.tryJoin(ch1, [pf], getCatalog, chars);
  mgr.tryJoin(ch2, [pf], getCatalog, chars);
  ch1.state = CharacterState.ACTIVITY;
  ch2.state = CharacterState.ACTIVITY;
  mgr.arrive(ch1);
  mgr.arrive(ch2);

  // Force ball to left end
  const session = mgr.getSessions().get('pp1')!;
  session.ballT = 0.05; // within SWING_FOLLOWTHROUGH_THRESHOLD (0.12) of left end (ballT=0)
  mgr.update(0.001, chars);

  assert.equal(ch1.frame, 2); // follow-through
});
