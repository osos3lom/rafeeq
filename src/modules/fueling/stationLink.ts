import type { FuelRequest, FuelType } from '../../domain/types';
import { connectivity } from '../../lib/connectivity';
import { createStore, uid, wait } from '../../lib/store';

// The station-side system (computer vision + robotic arm controller) is the
// source of truth for fueling progress. The app never "animates" progress on
// its own — it renders whatever the latest pump snapshot says.

export type PumpPhase = 'waiting' | 'fueling' | 'done';

export type ArmStage =
  | 'awaiting_vehicle'
  | 'vehicle_detected'
  | 'arm_positioning'
  | 'nozzle_connected'
  | 'dispensing'
  | 'arm_retracting'
  | 'complete';

export const PHASE_OF: Record<ArmStage, PumpPhase> = {
  awaiting_vehicle: 'waiting',
  vehicle_detected: 'waiting',
  arm_positioning: 'waiting',
  nozzle_connected: 'waiting',
  dispensing: 'fueling',
  arm_retracting: 'done',
  complete: 'done',
};

export interface PumpSnapshot {
  sessionId: string;
  phase: PumpPhase;
  stage: ArmStage;
  liters: number;
  amountSar: number;
  /** Requested liters, or the station's estimate for a full tank. */
  targetLiters: number;
  flowLpm: number;
  updatedAt: number;
}

export type PumpEvent =
  | { type: 'snapshot'; data: PumpSnapshot }
  | { type: 'connection'; online: boolean };

export interface StartSessionRequest {
  stationId: string;
  pumpNumber: number;
  fuelType: FuelType;
  request: FuelRequest;
  pricePerLiter: number;
  tankLiters: number;
  /** Pump must not dispense beyond the authorized hold. */
  maxAmountSar: number;
  plate: string;
}

export interface StationLink {
  startSession(req: StartSessionRequest): Promise<{ sessionId: string }>;
  /** Emits the current snapshot immediately, then every change. */
  subscribe(sessionId: string, onEvent: (e: PumpEvent) => void): () => void;
  /** Stop dispensing early (driver-initiated). */
  stop(sessionId: string): Promise<void>;
  /** Cancel before dispensing starts. */
  cancel(sessionId: string): Promise<void>;
}

// ---- WebSocket implementation (production shape, not used by the demo) -----

export function createSocketStationLink(baseUrl: string, getToken: () => string): StationLink {
  const call = async (path: string, body?: unknown) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${getToken()}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`station link ${res.status}`);
    return res.json();
  };
  return {
    startSession: (req) => call('/pump-sessions', req),
    stop: (id) => call(`/pump-sessions/${id}/stop`),
    cancel: (id) => call(`/pump-sessions/${id}/cancel`),
    subscribe(sessionId, onEvent) {
      let ws: WebSocket | null = null;
      let closed = false;
      let retry = 0;
      const open = () => {
        ws = new WebSocket(`${baseUrl.replace(/^http/, 'ws')}/pump-sessions/${sessionId}/events?token=${getToken()}`);
        ws.onopen = () => {
          retry = 0;
          onEvent({ type: 'connection', online: true });
        };
        ws.onmessage = (m) => onEvent({ type: 'snapshot', data: JSON.parse(m.data) as PumpSnapshot });
        ws.onclose = () => {
          if (closed) return;
          onEvent({ type: 'connection', online: false });
          setTimeout(open, Math.min(1000 * 2 ** retry++, 10_000));
        };
      };
      open();
      return () => {
        closed = true;
        ws?.close();
      };
    },
  };
}

// ---- Simulated station (demo) ------------------------------------------------

interface MockSession {
  id: string;
  startedAt: number;
  offsetMs: number;
  targetLiters: number;
  pricePerLiter: number;
  stoppedAtMs: number | null;
  cancelled: boolean;
}

const mockStore = createStore<{ sessions: Record<string, MockSession> }>({ sessions: {} }, 'mock-pump');

const T = { detected: 2500, positioning: 4500, connected: 8000, dispensing: 9500, retract: 3500 };
const dispenseMs = (liters: number) => Math.min(34_000, Math.max(18_000, liters * 520));

function stageBoundaries(s: MockSession) {
  const dispenseEnd = s.stoppedAtMs ?? T.dispensing + dispenseMs(s.targetLiters);
  return { dispenseEnd, retractEnd: dispenseEnd + T.retract };
}

function snapshotAt(s: MockSession, now: number): PumpSnapshot {
  const elapsed = now - s.startedAt + s.offsetMs;
  const { dispenseEnd, retractEnd } = stageBoundaries(s);
  const fullDuration = dispenseMs(s.targetLiters);

  let stage: ArmStage;
  if (elapsed < T.detected) stage = 'awaiting_vehicle';
  else if (elapsed < T.positioning) stage = 'vehicle_detected';
  else if (elapsed < T.connected) stage = 'arm_positioning';
  else if (elapsed < T.dispensing) stage = 'nozzle_connected';
  else if (elapsed < dispenseEnd) stage = 'dispensing';
  else if (elapsed < retractEnd) stage = 'arm_retracting';
  else stage = 'complete';

  const dispensedMs = Math.max(0, Math.min(elapsed, dispenseEnd) - T.dispensing);
  // Flow ramps up over the first second and is steady after that.
  const ramp = Math.min(1, dispensedMs / 1000);
  const fraction = Math.min(1, Math.max(0, (dispensedMs - 500 * (1 - ramp)) / fullDuration));
  const liters = Math.round(s.targetLiters * fraction * 100) / 100;

  return {
    sessionId: s.id,
    phase: PHASE_OF[stage],
    stage,
    liters,
    amountSar: Math.round(liters * s.pricePerLiter * 100) / 100,
    targetLiters: s.targetLiters,
    flowLpm: stage === 'dispensing' ? Math.round((s.targetLiters / (fullDuration / 60_000)) * ramp) : 0,
    updatedAt: now,
  };
}

export const mockStationLink: StationLink & { fastForward(sessionId: string): void } = {
  async startSession(req) {
    await wait(300);
    const targetLiters =
      req.request.mode === 'amount'
        ? req.request.sar / req.pricePerLiter
        : req.request.mode === 'liters'
          ? req.request.liters
          : // Full tank: the station estimates remaining capacity; the simulation stops at ~64% of tank.
            Math.min(req.tankLiters * 0.64, req.maxAmountSar / req.pricePerLiter);
    const session: MockSession = {
      id: uid('pump'),
      startedAt: Date.now(),
      offsetMs: 0,
      targetLiters: Math.round(targetLiters * 100) / 100,
      pricePerLiter: req.pricePerLiter,
      stoppedAtMs: null,
      cancelled: false,
    };
    mockStore.set((s) => ({ sessions: { ...s.sessions, [session.id]: session } }));
    return { sessionId: session.id };
  },

  subscribe(sessionId, onEvent) {
    let wasOnline = true;
    const tick = () => {
      const online = connectivity.isOnline();
      if (online !== wasOnline) {
        wasOnline = online;
        onEvent({ type: 'connection', online });
      }
      if (!online) return;
      const s = mockStore.get().sessions[sessionId];
      if (!s || s.cancelled) return;
      onEvent({ type: 'snapshot', data: snapshotAt(s, Date.now()) });
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  },

  async stop(sessionId) {
    const s = mockStore.get().sessions[sessionId];
    if (!s) return;
    const elapsed = Date.now() - s.startedAt + s.offsetMs;
    if (elapsed >= T.dispensing) {
      mockStore.set((st) => ({ sessions: { ...st.sessions, [sessionId]: { ...s, stoppedAtMs: Math.max(elapsed, T.dispensing + 800) } } }));
    }
  },

  async cancel(sessionId) {
    const s = mockStore.get().sessions[sessionId];
    if (!s) return;
    mockStore.set((st) => ({ sessions: { ...st.sessions, [sessionId]: { ...s, cancelled: true } } }));
  },

  /** Demo helper: jump to the next arm stage. */
  fastForward(sessionId) {
    const s = mockStore.get().sessions[sessionId];
    if (!s) return;
    const elapsed = Date.now() - s.startedAt + s.offsetMs;
    const { dispenseEnd, retractEnd } = stageBoundaries(s);
    const marks = [T.detected, T.positioning, T.connected, T.dispensing, dispenseEnd - 1500, dispenseEnd, retractEnd];
    const next = marks.find((m) => m > elapsed + 50);
    if (next === undefined) return;
    mockStore.set((st) => ({ sessions: { ...st.sessions, [sessionId]: { ...s, offsetMs: s.offsetMs + (next - elapsed) } } }));
  },
};

export const stationLink = mockStationLink;
