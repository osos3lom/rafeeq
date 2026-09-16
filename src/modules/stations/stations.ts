import { DEMO_ARRIVAL, STATIONS, USER_LOCATION } from '../../data/stations';
import type { FuelType, LatLng, PumpStatus, Station, StationLiveStatus } from '../../domain/types';
import { createStore } from '../../lib/store';
import { connectivity } from '../../lib/connectivity';

export const stationById = (id: string) => STATIONS.find((s) => s.id === id) ?? null;

export function distanceKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const stationsByDistance = () =>
  STATIONS.map((s) => ({ station: s, km: distanceKm(USER_LOCATION, s.location) })).sort((a, b) => a.km - b.km);

// ---- Live status feed ------------------------------------------------------
// Production: a push channel from each station's controller. Persisted so the
// last known status is shown when offline.

function initialStatus(s: Station): StationLiveStatus {
  const pumpStatus: Record<number, PumpStatus> = {};
  s.pumps.forEach((p) => (pumpStatus[p.number] = p.status));
  const available = s.pumps.filter((p) => p.status === 'available').length;
  return { stationId: s.id, availablePumps: available, queueLength: available === 0 ? 2 : 0, pumpStatus, updatedAt: Date.now() };
}

export const liveStore = createStore<{ byStation: Record<string, StationLiveStatus> }>(
  { byStation: Object.fromEntries(STATIONS.filter((s) => s.hasRafeeq).map((s) => [s.id, initialStatus(s)])) },
  'live-status',
);

let feedTimer: ReturnType<typeof setInterval> | null = null;
/** Pumps reserved by the driver's own session are never flipped by the simulation. */
const pinned = new Set<string>();
export const pinPump = (stationId: string, pump: number) => pinned.add(`${stationId}:${pump}`);
export const unpinPump = (stationId: string, pump: number) => pinned.delete(`${stationId}:${pump}`);

export function startLiveFeed() {
  if (feedTimer) return;
  feedTimer = setInterval(() => {
    if (!connectivity.isOnline()) return;
    liveStore.set((st) => {
      const byStation = { ...st.byStation };
      for (const s of STATIONS.filter((x) => x.hasRafeeq)) {
        const cur = byStation[s.id] ?? initialStatus(s);
        const pumpStatus = { ...cur.pumpStatus };
        const candidates = s.pumps.filter((p) => pumpStatus[p.number] !== 'offline' && !pinned.has(`${s.id}:${p.number}`));
        if (candidates.length && Math.random() < 0.5) {
          // Drift around ~half the pumps busy so stations stay realistic.
          const free = candidates.filter((p) => pumpStatus[p.number] === 'available');
          const busy = candidates.filter((p) => pumpStatus[p.number] === 'busy');
          const pool = free.length > candidates.length / 2 || busy.length === 0 ? free : busy;
          const p = pool[Math.floor(Math.random() * pool.length)];
          if (p && (pool === busy || free.length > 1)) pumpStatus[p.number] = pumpStatus[p.number] === 'available' ? 'busy' : 'available';
        }
        const available = Object.values(pumpStatus).filter((x) => x === 'available').length;
        byStation[s.id] = {
          stationId: s.id,
          pumpStatus,
          availablePumps: available,
          queueLength: available === 0 ? 1 + Math.floor(Math.random() * 3) : 0,
          updatedAt: Date.now(),
        };
      }
      return { byStation };
    });
  }, 9000);
}

export function bestPump(station: Station, fuel: FuelType, live?: StationLiveStatus) {
  const status = (n: number) => live?.pumpStatus[n] ?? station.pumps.find((p) => p.number === n)?.status;
  return (
    station.pumps.find((p) => p.robotic && p.fuels.includes(fuel) && status(p.number) === 'available') ??
    station.pumps.find((p) => p.fuels.includes(fuel) && status(p.number) === 'available') ??
    null
  );
}

// ---- Arrival (geofence + plate recognition) ------------------------------------

export const arrivalStore = createStore<{ stationId: string | null; pumpNumber: number | null; vehicleId: string | null }>({
  stationId: null,
  pumpNumber: null,
  vehicleId: null,
});

export function simulateArrival(vehicleId: string | null) {
  pinPump(DEMO_ARRIVAL.stationId, DEMO_ARRIVAL.pumpNumber);
  liveStore.set((st) => {
    const cur = st.byStation[DEMO_ARRIVAL.stationId];
    if (!cur) return {};
    const pumpStatus = { ...cur.pumpStatus, [DEMO_ARRIVAL.pumpNumber]: 'available' as const };
    return { byStation: { ...st.byStation, [DEMO_ARRIVAL.stationId]: { ...cur, pumpStatus } } };
  });
  arrivalStore.set({ ...DEMO_ARRIVAL, vehicleId });
}

export const clearArrival = () => arrivalStore.set({ stationId: null, pumpNumber: null, vehicleId: null });
