import { Bot, ChevronLeft, Coffee, Info, Navigation, Zap } from 'lucide-react';
import { router } from '../app/router';
import type { FuelType } from '../domain/types';
import { useI18n } from '../i18n/i18n';
import { useNow } from '../lib/useNow';
import { useStore } from '../lib/store';
import { accountStore, defaultVehicle } from '../modules/account/accountStore';
import { bestPump, distanceKm, liveStore, stationById } from '../modules/stations/stations';
import { USER_LOCATION } from '../data/stations';
import { Button, Card, FuelBadge, Pill, Screen, SectionTitle, cx } from '../ui/kit';

export function StationDetailScreen({ stationId }: { stationId: string }) {
  const { s, pick, num } = useI18n();
  const station = stationById(stationId)!;
  const live = useStore(liveStore).byStation[stationId];
  const vehicle = defaultVehicle(useStore(accountStore));
  const now = useNow();

  const km = distanceKm(USER_LOCATION, station.location);
  const fuel: FuelType = vehicle?.fuelType ?? '91';
  const auto = station.hasRafeeq ? bestPump(station, fuel, live) : null;
  const choose = (pump: number) => (vehicle ? router.push({ name: 'fuel', stationId, pump }) : router.push({ name: 'vehicle' }));

  return (
    <Screen title={pick(station.nameAr, station.nameEn)} subtitle={`${pick(station.districtAr, station.districtEn)} · ${num(km, 1)} ${s.common.km}`}>
      {station.hasRafeeq && live && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Pill tone="teal">
            <span className="size-1.5 animate-pulse rounded-full bg-teal-500" />
            {s.home.pumpsFree(live.availablePumps, station.pumps.length)}
          </Pill>
          <Pill tone={live.queueLength ? 'amber' : 'neutral'}>{s.home.queue(live.queueLength)}</Pill>
          {station.open24h && <Pill>{s.station.open24}</Pill>}
          <span className="text-[11px] text-navy-400">{s.common.updatedAgo(Math.max(0, Math.round((now - live.updatedAt) / 1000)))}</span>
        </div>
      )}

      {!station.hasRafeeq && (
        <Card className="mt-3 flex gap-3">
          <Info className="size-6 shrink-0 text-navy-400" aria-hidden />
          <div>
            <p className="font-bold text-navy-800">{s.station.notRafeeqTitle}</p>
            <p className="mt-1 text-sm leading-relaxed text-navy-500">{s.station.notRafeeqBody}</p>
            <Button variant="soft" size="md" className="mt-3">
              <Navigation className="size-4" aria-hidden />
              {s.station.directions}
            </Button>
          </div>
        </Card>
      )}

      <SectionTitle>{s.station.prices}</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        {(['91', '95', 'diesel'] as FuelType[]).map((f) => (
          <Card key={f} className={cx('p-3 text-center', f === fuel && 'ring-2 ring-teal-600')}>
            <FuelBadge fuel={f} />
            <p className="mt-2 text-lg font-bold tabular-nums text-navy-800">{num(station.prices[f], 2)}</p>
            <p className="text-[11px] text-navy-500">{s.station.perLiter}</p>
          </Card>
        ))}
      </div>

      {station.hasRafeeq && (
        <>
          <SectionTitle>{s.station.pumps}</SectionTitle>
          {auto && (
            <Button block onClick={() => choose(auto.number)} className="mb-3">
              <Zap className="size-5" aria-hidden />
              {s.station.autoPump} · {s.station.pump(auto.number)}
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            {station.pumps.map((p) => {
              const status = live?.pumpStatus[p.number] ?? p.status;
              const usable = status === 'available' && p.fuels.includes(fuel);
              return (
                <button
                  key={p.number}
                  disabled={!usable}
                  onClick={() => choose(p.number)}
                  className={cx(
                    'min-h-24 rounded-3xl bg-white p-3 text-start shadow-card ring-2 ring-transparent transition-colors',
                    usable ? 'hover:ring-teal-600' : 'opacity-55',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-navy-800">{p.number}</span>
                    <span
                      className={cx(
                        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        status === 'available' ? 'bg-teal-50 text-teal-700' : status === 'busy' ? 'bg-amber-50 text-amber-800' : 'bg-navy-50 text-navy-500',
                      )}
                    >
                      {s.station[status]}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.fuels.map((f) => (
                      <FuelBadge key={f} fuel={f} />
                    ))}
                  </div>
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-navy-500">
                    {p.robotic && <Bot className="size-3.5" aria-hidden />}
                    {p.robotic ? s.station.robotic : s.station.manual}
                  </p>
                </button>
              );
            })}
          </div>
        </>
      )}

      {station.menuId && (
        <button onClick={() => router.push({ name: 'menu', stationId })} className="mt-4 block w-full text-start">
          <Card className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-[#EFE6DD] text-[#6B4A32]">
              <Coffee className="size-6" aria-hidden />
            </span>
            <div className="flex-1">
              <p className="font-bold text-navy-800">{s.station.preorderTitle}</p>
              <p className="text-xs text-navy-500">{s.station.preorderBody}</p>
            </div>
            <ChevronLeft className="size-5 text-navy-300 ltr:rotate-180" aria-hidden />
          </Card>
        </button>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {station.amenities.map((a) => (
          <Pill key={a}>{s.station.amenities[a]}</Pill>
        ))}
      </div>
    </Screen>
  );
}
