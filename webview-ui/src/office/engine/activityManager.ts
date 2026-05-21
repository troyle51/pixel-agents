import type {
  ActivitySession,
  ActivitySlotDef,
  Character,
  FurnitureCatalogEntry,
  PlacedFurniture,
} from '../types.js';
import { CharacterState } from '../types.js';

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

  private createSession(pf: PlacedFurniture, entry: FurnitureCatalogEntry): ActivitySession {
    return {
      id: pf.uid,
      activityId: entry.activityId!,
      furnitureCol: pf.col,
      furnitureRow: pf.row,
      minPlayers: entry.activityMinPlayers ?? 1,
      slots: (entry.activitySlots ?? []).map(() => ({ participantId: null, arrived: false })),
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

    const arrivedCount = session.slots.filter((s) => s.arrived).length;
    if (arrivedCount >= session.minPlayers) {
      session.phase = 'active';
      this.initSession(session);
    }
  }

  private initSession(session: ActivitySession): void {
    // Handlers added in later tasks
    void session;
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
    // Handlers added in later tasks
    void dt;
    void characters;
  }

  getSessions(): Map<string, ActivitySession> {
    return this.sessions;
  }
}
