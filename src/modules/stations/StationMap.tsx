import { Fuel } from 'lucide-react';
import { STATIONS, USER_LOCATION } from '../../data/stations';
import type { LatLng } from '../../domain/types';
import { useI18n } from '../../i18n/i18n';
import { useStore } from '../../lib/store';
import { liveStore } from './stations';

// Stylized, offline-safe map. In production swap for Mapbox / Google Maps with
// the same props (stations, selection, live status).

const W = 340;
const H = 220;
const B = { latMin: 24.688, latMax: 24.828, lngMin: 46.585, lngMax: 46.735 };

const project = ({ lat, lng }: LatLng) => ({
  x: ((lng - B.lngMin) / (B.lngMax - B.lngMin)) * W,
  y: ((B.latMax - lat) / (B.latMax - B.latMin)) * H,
});

const path = (pts: [number, number][]) =>
  pts.map(([lat, lng], i) => {
    const p = project({ lat, lng });
    return `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }).join(' ');

const ROADS = [
  { id: 'kfahd', w: 5, pts: [[24.685, 46.690], [24.73, 46.668], [24.78, 46.641], [24.82, 46.622]] as [number, number][], ar: 'طريق الملك فهد', en: 'King Fahd Rd', at: [24.748, 46.655] },
  { id: 'ring', w: 5, pts: [[24.772, 46.585], [24.783, 46.64], [24.786, 46.69], [24.78, 46.74]] as [number, number][], ar: 'الدائري الشمالي', en: 'Northern Ring Rd', at: [24.791, 46.712] },
  { id: 'kabd', w: 4, pts: [[24.733, 46.585], [24.737, 46.66], [24.735, 46.74]] as [number, number][], ar: 'طريق الملك عبدالله', en: 'King Abdullah Rd', at: [24.742, 46.61] },
  { id: 'olaya', w: 2.5, pts: [[24.685, 46.700], [24.74, 46.672], [24.80, 46.643]] as [number, number][] },
  { id: 'turki', w: 2.5, pts: [[24.70, 46.622], [24.76, 46.614], [24.815, 46.618]] as [number, number][] },
  { id: 'sultan', w: 2.5, pts: [[24.69, 46.712], [24.745, 46.705], [24.80, 46.70]] as [number, number][] },
];

const WADI: [number, number][] = [[24.815, 46.598], [24.78, 46.592], [24.75, 46.601], [24.72, 46.594], [24.69, 46.603]];

export function StationMap({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const { lang } = useI18n();
  const live = useStore(liveStore).byStation;
  const me = project(USER_LOCATION);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-full w-full" role="group" aria-label="map">
      <rect width={W} height={H} fill="#E9EFF1" />
      {/* blocks */}
      {Array.from({ length: 7 }).map((_, i) => (
        <line key={`g${i}`} x1={0} x2={W} y1={20 + i * 32} y2={10 + i * 32} stroke="#DFE7EA" strokeWidth="1" />
      ))}
      <path d={path(WADI)} fill="none" stroke="#CFE3D4" strokeWidth="10" strokeLinecap="round" />
      {ROADS.map((r) => (
        <g key={r.id}>
          <path d={path(r.pts)} fill="none" stroke="#FFFFFF" strokeWidth={r.w + 2} strokeLinecap="round" strokeLinejoin="round" />
          <path d={path(r.pts)} fill="none" stroke={r.w > 3 ? '#F7F0DC' : '#FFFFFF'} strokeWidth={r.w} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
      {ROADS.filter((r) => r.at).map((r) => {
        const p = project({ lat: r.at![0], lng: r.at![1] });
        return (
          <text key={`t${r.id}`} x={p.x} y={p.y} fontSize="7" fill="#5D7F95" textAnchor="middle" fontWeight="500">
            {lang === 'ar' ? r.ar : r.en}
          </text>
        );
      })}

      {/* user */}
      <circle cx={me.x} cy={me.y} r="14" fill="#3A7CA5" opacity="0.12" />
      <circle cx={me.x} cy={me.y} r="5.5" fill="#fff" />
      <circle cx={me.x} cy={me.y} r="3.8" fill="#3A7CA5" />

      {STATIONS.map((st) => {
        const p = project(st.location);
        const selected = st.id === selectedId;
        const name = lang === 'ar' ? st.nameAr : st.nameEn;
        if (!st.hasRafeeq) {
          return (
            <g key={st.id} role="button" tabIndex={0} aria-label={name} onClick={() => onSelect(st.id)} onKeyDown={(e) => e.key === 'Enter' && onSelect(st.id)} className="cursor-pointer">
              <circle cx={p.x} cy={p.y} r={selected ? 9 : 7} fill="#fff" stroke="#96BDD4" strokeWidth="1.5" />
              <circle cx={p.x} cy={p.y} r="2.4" fill="#96BDD4" />
            </g>
          );
        }
        const free = live[st.id]?.availablePumps ?? 0;
        return (
          <g key={st.id} role="button" tabIndex={0} aria-label={name} onClick={() => onSelect(st.id)} onKeyDown={(e) => e.key === 'Enter' && onSelect(st.id)} className="cursor-pointer">
            {selected && <circle cx={p.x} cy={p.y - 12} r="19" fill="#0F7A72" opacity="0.15" />}
            <path
              d={`M${p.x} ${p.y} l-6 -8 a 11 11 0 1 1 12 0 z`}
              fill={selected ? '#12324A' : '#0F7A72'}
              stroke="#fff"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <foreignObject x={p.x - 6} y={p.y - 23} width="12" height="12">
              <Fuel color="#fff" width={12} height={12} strokeWidth={2.2} />
            </foreignObject>
            <g>
              <circle cx={p.x + 9} cy={p.y - 24} r="6" fill={free > 0 ? '#fff' : '#FDE68A'} stroke={selected ? '#12324A' : '#0F7A72'} strokeWidth="1.2" />
              <text x={p.x + 9} y={p.y - 21.6} fontSize="7" fontWeight="700" textAnchor="middle" fill="#12324A">
                {free}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
