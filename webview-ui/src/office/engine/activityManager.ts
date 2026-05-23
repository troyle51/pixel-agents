import {
  BALL_SPEED,
  BOOKSHELF_BROWSE_MAX_SEC,
  BOOKSHELF_BROWSE_MIN_SEC,
  COFFEE_POUR_DURATION_SEC,
  COUCH_NAP_MAX_SEC,
  COUCH_NAP_MIN_SEC,
  SWING_FOLLOWTHROUGH_THRESHOLD,
  SWING_WINDUP_THRESHOLD,
  WATER_PLANT_DURATION_SEC,
  WHITEBOARD_PRESENTER_ROTATE_SEC,
} from '../../constants.js';
import type {
  ActivitySession,
  ActivitySlotDef,
  Character,
  FurnitureCatalogEntry,
  PlacedFurniture,
} from '../types.js';
import { CharacterState, Direction } from '../types.js';

function parseFacingDir(dir: string): Direction {
  switch (dir.toLowerCase()) {
    case 'up':
      return Direction.UP;
    case 'left':
      return Direction.LEFT;
    case 'right':
      return Direction.RIGHT;
    default:
      return Direction.DOWN;
  }
}

export class ActivityManager {
  private sessions = new Map<string, ActivitySession>();

  tryJoin(
    ch: Character,
    placedFurniture: PlacedFurniture[],
    getCatalog: (type: string) => FurnitureCatalogEntry | null,
    characters: Map<number, Character>,
  ): { session: ActivitySession; slotIndex: number; targetCol: number; targetRow: number } | null {
    void characters;
    const shuffled = [...placedFurniture].sort(() => Math.random() - 0.5);

    for (const pf of shuffled) {
      const entry = getCatalog(pf.type);
      if (!entry?.activityId || !entry.activitySlots?.length) continue;

      const existingSession = this.sessions.get(pf.uid);
      const session = existingSession ?? this.createSession(pf, entry);

      const slotIdx = session.slots.findIndex((s) => s.participantId === null);
      if (slotIdx === -1) continue;

      // Slot is available — commit the session if it's new
      if (!existingSession) {
        this.sessions.set(pf.uid, session);
      }

      session.slots[slotIdx].participantId = ch.id;
      ch.activitySessionId = session.id;

      const slotDef = entry.activitySlots[slotIdx] as ActivitySlotDef;
      const targetCol = pf.col + slotDef.offsetCol;
      const targetRow = pf.row + slotDef.offsetRow;

      return { session, slotIndex: slotIdx, targetCol, targetRow };
    }

    return null;
  }

  tryJoinWaiting(
    ch: Character,
    placedFurniture: PlacedFurniture[],
    getCatalog: (type: string) => FurnitureCatalogEntry | null,
  ): { session: ActivitySession; slotIndex: number; targetCol: number; targetRow: number } | null {
    for (const session of this.sessions.values()) {
      if (session.phase !== 'waiting' || session.minPlayers <= 1) continue;
      const slotIdx = session.slots.findIndex((s) => s.participantId === null);
      if (slotIdx === -1) continue;
      const pf = placedFurniture.find((f) => f.uid === session.id);
      if (!pf) continue;
      const entry = getCatalog(pf.type);
      if (!entry?.activitySlots) continue;
      session.slots[slotIdx].participantId = ch.id;
      ch.activitySessionId = session.id;
      const slotDef = entry.activitySlots[slotIdx] as ActivitySlotDef;
      return {
        session,
        slotIndex: slotIdx,
        targetCol: pf.col + slotDef.offsetCol,
        targetRow: pf.row + slotDef.offsetRow,
      };
    }
    return null;
  }

  private createSession(pf: PlacedFurniture, entry: FurnitureCatalogEntry): ActivitySession {
    return {
      id: pf.uid,
      activityId: entry.activityId!,
      furnitureCol: pf.col,
      furnitureRow: pf.row,
      minPlayers: entry.activityMinPlayers ?? 1,
      slots: (entry.activitySlots ?? []).map((slotDef) => ({
        participantId: null,
        arrived: false,
        facingDir: parseFacingDir(slotDef.facingDir),
      })),
      phase: 'waiting',
      timer: 0,
      ballT: 0.5,
      ballDir: 1,
      presenterIdx: 0,
      presenterTimer: 0,
    };
  }

  arrive(ch: Character): void {
    if (!ch.activitySessionId) return;
    const session = this.sessions.get(ch.activitySessionId);
    if (!session) return;
    const slot = session.slots.find((s) => s.participantId === ch.id);
    if (!slot) return;
    slot.arrived = true;
    ch.dir = slot.facingDir;

    const arrivedCount = session.slots.filter((s) => s.arrived).length;
    if (arrivedCount >= session.minPlayers) {
      session.phase = 'active';
      this.initSession(session);
    }
  }

  private initSession(session: ActivitySession): void {
    switch (session.activityId) {
      case 'ping_pong':
        session.ballT = 0;
        session.ballDir = 1;
        break;
      case 'coffee':
        session.timer = COFFEE_POUR_DURATION_SEC;
        break;
      case 'couch':
        session.timer = COUCH_NAP_MIN_SEC + Math.random() * (COUCH_NAP_MAX_SEC - COUCH_NAP_MIN_SEC);
        break;
      case 'water_plant':
        session.timer = WATER_PLANT_DURATION_SEC;
        break;
      case 'bookshelf':
        session.timer =
          BOOKSHELF_BROWSE_MIN_SEC +
          Math.random() * (BOOKSHELF_BROWSE_MAX_SEC - BOOKSHELF_BROWSE_MIN_SEC);
        break;
      case 'whiteboard':
        session.presenterIdx = 0;
        session.presenterTimer = WHITEBOARD_PRESENTER_ROTATE_SEC;
        break;
    }
  }

  leave(ch: Character, characters: Map<number, Character>): void {
    if (!ch.activitySessionId) return;
    const sessionId = ch.activitySessionId;
    const session = this.sessions.get(sessionId);
    this.resetChar(ch);
    if (!session) return;

    const slot = session.slots.find((s) => s.participantId === ch.id);
    if (slot) {
      slot.participantId = null;
      slot.arrived = false;
    }

    if (session.minPlayers > 1) {
      this.endSession(sessionId, characters);
    } else if (session.slots.every((s) => s.participantId === null)) {
      this.sessions.delete(sessionId);
    } else {
      session.phase = 'waiting';
    }
  }

  private resetChar(ch: Character): void {
    ch.activitySessionId = null;
    ch.state = CharacterState.IDLE;
    ch.frame = 0;
    ch.frameTimer = 0;
  }

  private endSession(uid: string, characters: Map<number, Character>): void {
    const session = this.sessions.get(uid);
    if (!session) return;
    for (const slot of session.slots) {
      if (slot.participantId !== null) {
        const other = characters.get(slot.participantId);
        if (other) this.resetChar(other);
        slot.participantId = null;
        slot.arrived = false;
      }
    }
    this.sessions.delete(uid);
  }

  update(dt: number, characters: Map<number, Character>): void {
    for (const [uid, session] of this.sessions) {
      if (session.phase !== 'active') continue;
      switch (session.activityId) {
        case 'ping_pong':
          this.tickPingPong(session, dt, characters);
          break;
        case 'coffee':
        case 'water_plant':
        case 'couch':
        case 'bookshelf':
          session.timer -= dt;
          if (session.timer <= 0) this.endSession(uid, characters);
          break;
        case 'whiteboard':
          this.tickWhiteboard(session, dt, characters);
          break;
      }
    }
  }

  private tickPingPong(
    session: ActivitySession,
    dt: number,
    characters: Map<number, Character>,
  ): void {
    session.ballT += session.ballDir * BALL_SPEED * dt;
    if (session.ballT >= 1) {
      session.ballT = 1;
      session.ballDir = -1;
    }
    if (session.ballT <= 0) {
      session.ballT = 0;
      session.ballDir = 1;
    }

    // slot 0 = left player (ballT=0 is their end), slot 1 = right player (ballT=1 is their end)
    for (let i = 0; i < session.slots.length; i++) {
      const slot = session.slots[i];
      if (!slot.arrived || slot.participantId === null) continue;
      const ch = characters.get(slot.participantId);
      if (!ch) continue;
      const proximity = i === 0 ? session.ballT : 1 - session.ballT;
      if (proximity <= SWING_FOLLOWTHROUGH_THRESHOLD) {
        ch.frame = 2;
      } else if (proximity <= SWING_WINDUP_THRESHOLD) {
        ch.frame = 1;
      } else {
        ch.frame = 0;
      }
    }
  }

  private tickWhiteboard(
    session: ActivitySession,
    dt: number,
    characters: Map<number, Character>,
  ): void {
    session.presenterTimer -= dt;
    if (session.presenterTimer <= 0) {
      session.presenterTimer = WHITEBOARD_PRESENTER_ROTATE_SEC;
      const active = session.slots
        .map((s, i) => ({ s, i }))
        .filter(({ s }) => s.arrived && s.participantId !== null);
      if (active.length > 0) {
        const cur = active.findIndex(({ i }) => i === session.presenterIdx);
        session.presenterIdx = active[(cur + 1) % active.length].i;
      }
    }
    for (let i = 0; i < session.slots.length; i++) {
      const slot = session.slots[i];
      if (!slot.arrived || slot.participantId === null) continue;
      const ch = characters.get(slot.participantId);
      if (!ch) continue;
      // frame 3 = presenter (typing/gesturing), frame 4 = audience (reading/watching)
      ch.frame = i === session.presenterIdx ? 3 : 4;
    }
  }

  getSessions(): Map<string, ActivitySession> {
    return this.sessions;
  }
}
