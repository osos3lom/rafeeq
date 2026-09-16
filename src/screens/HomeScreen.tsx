import { ChevronLeft, Crown, Fuel, MapPin, ScanLine, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { router } from '../app/router';
import { useI18n } from '../i18n/i18n';
import { useStore } from '../lib/store';
import { accountStore, defaultVehicle, isPlus } from '../modules/account/accountStore';
import { tierFor } from '../modules/loyalty/loyalty';
import { orderById, ordersStore } from '../modules/orders/checkout';
import { StationMap } from '../modules/stations/StationMap';
import { arrivalStore, bestPump, liveStore, simulateArrival, stationById, stationsByDistance } from '../modules/stations/stations';
import { Button, Card, Pill, SectionTitle, cx } from '../ui/kit';
import { FuelGauge, Plate } from '../ui/visuals';

export function HomeScreen() {
  const { s, pick, num } = useI18n();
  const account = useStore(accountStore);
  const arrival = useStore(arrivalStore);
  const live = useStore(liveStore).byStation;
  const { activeOrderId, snapshots } = useStore(ordersStore);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const user = account.user!;
  const vehicle = defaultVehicle(account);
  const list = stationsByDistance();
  const nearestRafeeq = list.find((x) => x.station.hasRafeeq)!;
  const selected = selectedId ? list.find((x) => x.station.id === selectedId)! : null;
  const arrivedStation = arrival.stationId ? stationById(arrival.stationId) : null;
  const activeOrder = activeOrderId ? orderById(activeOrderId) : null;
  const activeSnap = activeOrder?.pumpSessionId ? snapshots[activeOrder.pumpSessionId] : null;
  const tier = tierFor(user.tierPoints);
  const hour = new Date().getHours();

  // Demo geofence: a few seconds on Home "arrives" at the nearest Rafeeq station once per session.
  useEffect(() => {
    if (activeOrderId || !vehicle?.recognitionLinked) return;
    try {
      if (sessionStorage.getItem('rafeeq:arrived')) return;
    } catch {
      return;
    }
    const t = setTimeout(() => {
      sessionStorage.setItem('rafeeq:arrived', '1');
      simulateArrival(vehicle.id);
    }, 6000);
    return () => clearTimeout(t);
  }, [activeOrderId, vehicle?.id, vehicle?.recognitionLinked]);

  const payAtPump = () => {
    if (!vehicle) return router.push({ name: 'vehicle' });
    if (arrivedStation && arrival.pumpNumber) return router.push({ name: 'fuel', stationId: arrivedStation.id, pump: arrival.pumpNumber });
    const st = nearestRafeeq.station;
    const pump = bestPump(st, vehicle.fuelType, live[st.id]);
    router.push(pump ? { name: 'fuel', stationId: st.id, pump: pump.number } : { name: 'station', stationId: st.id });
  };

  return (
    <div className="h-full overflow-y-auto px-4 pb-28 pt-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-navy-500">{hour < 12 ? s.home.greetingMorning : s.home.greetingEvening}</p>
          <h1 className="text-2xl font-bold text-navy-800">{user.name}</h1>
        </div>
        <button onClick={() => router.tab('rewards')} className="flex min-h-11 items-center gap-2 rounded-full bg-white py-1.5 pe-4 ps-1.5 shadow-card">
          <span className="grid size-8 place-items-center rounded-full bg-teal-600 text-white">
            {isPlus(user) ? <Crown className="size-4" aria-hidden /> : <Fuel className="size-4" aria-hidden />}
          </span>
          <span className="text-start leading-tight">
            <span className="block text-sm font-bold tabular-nums text-navy-800">{num(user.pointsBalance)}</span>
            <span className="block text-[10px] text-navy-500">{s.home.points}</span>
          </span>
        </button>
      </header>

      {/* Active visit takes priority over everything else */}
      {activeOrder && (
        <button onClick={() => router.push({ name: 'session', orderId: activeOrder.id })} className="mt-4 block w-full text-start">
          <Card className="flex items-center gap-4 bg-navy-800 text-white">
            <div className="w-24 shrink-0">
              <FuelGauge value={activeSnap ? activeSnap.liters / activeSnap.targetLiters : 0} size={96} tone="light" marks={['', '']} active />
            </div>
            <div className="flex-1">
              <p className="text-xs text-teal-200">{s.home.activeVisit}</p>
              <p className="font-bold">{pick(stationById(activeOrder.stationId)!.nameAr, stationById(activeOrder.stationId)!.nameEn)}</p>
              <p className="mt-1 text-sm text-navy-200">
                {activeSnap ? s.session.stage[activeSnap.stage] : s.session.stepWaiting}
              </p>
            </div>
            <ChevronLeft className="size-5 text-navy-300 ltr:rotate-180" aria-hidden />
          </Card>
        </button>
      )}

      {/* Pay at pump */}
      {!activeOrder && (
        <Card className="mt-4 overflow-hidden p-0">
          {arrivedStation ? (
            <div className="animate-rise bg-teal-600 px-5 pb-5 pt-4 text-white">
              <div className="flex items-center gap-2 text-sm text-teal-50">
                <ScanLine className="size-4" aria-hidden />
                {s.home.plateRecognized}
              </div>
              <p className="mt-2 text-sm text-teal-100">{s.home.arrivedAt}</p>
              <p className="text-xl font-bold">{pick(arrivedStation.nameAr, arrivedStation.nameEn)}</p>
              <div className="mt-3 flex items-center gap-3">
                <span className="rounded-xl bg-white/15 px-3 py-1.5 text-lg font-bold">{s.home.pumpDetected(arrival.pumpNumber!)}</span>
                {vehicle && <Plate plate={vehicle.plate} size="sm" />}
              </div>
              <Button block variant="inverse" className="mt-4" onClick={payAtPump}>
                <Fuel className="size-5" aria-hidden />
                {s.home.payAndFill}
              </Button>
            </div>
          ) : (
            <div className="p-5">
              {vehicle ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-navy-500">{s.home.nearest}</p>
                      <p className="truncate font-bold text-navy-800">{pick(nearestRafeeq.station.nameAr, nearestRafeeq.station.nameEn)}</p>
                      <p className="mt-0.5 text-xs text-navy-500">
                        {num(nearestRafeeq.km, 1)} {s.common.km} · {s.home.queue(live[nearestRafeeq.station.id]?.queueLength ?? 0)}
                      </p>
                    </div>
                    <Plate plate={vehicle.plate} size="sm" />
                  </div>
                  <Button block className="mt-4" onClick={payAtPump}>
                    <Fuel className="size-5" aria-hidden />
                    {s.home.payAtPump}
                  </Button>
                </>
              ) : (
                <>
                  <p className="font-semibold text-navy-700">{s.home.addVehicleFirst}</p>
                  <Button block className="mt-4" onClick={() => router.push({ name: 'vehicle' })}>
                    {s.home.addVehicle}
                  </Button>
                </>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Loyalty */}
      <button onClick={() => router.tab('rewards')} className="mt-3 block w-full text-start">
        <Card className="flex items-center gap-4">
          <div className="w-20 shrink-0">
            <FuelGauge value={tier.progress} size={80} marks={['', '']} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-navy-800">{s.loyalty.tiers[tier.current.id]}</span>
              {isPlus(user) && <Pill tone="navy"><Crown className="size-3" aria-hidden />{s.loyalty.plus}</Pill>}
            </div>
            <p className="mt-0.5 text-xs text-navy-500">
              {tier.next ? s.loyalty.toNext(num(tier.remaining), s.loyalty.tiers[tier.next.id]) : s.loyalty.topTier}
            </p>
          </div>
          <ChevronLeft className="size-5 text-navy-300 ltr:rotate-180" aria-hidden />
        </Card>
      </button>

      {/* Stations */}
      <SectionTitle>{s.home.nearby}</SectionTitle>
      <Card className="overflow-hidden p-0">
        <div className="relative aspect-[34/22]">
          <StationMap selectedId={selectedId} onSelect={setSelectedId} />
          <span className="absolute bottom-2 start-2 rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-navy-500">{s.home.mapCaption}</span>
        </div>
        {selected && (
          <button
            onClick={() => router.push({ name: 'station', stationId: selected.station.id })}
            className="flex w-full items-center gap-3 border-t border-navy-50 px-4 py-3 text-start"
          >
            <StationLine station={selected.station} km={selected.km} />
          </button>
        )}
      </Card>

      <div className="mt-3 space-y-2">
        {list.map(({ station, km }) => (
          <button
            key={station.id}
            onClick={() => router.push({ name: 'station', stationId: station.id })}
            className={cx('flex min-h-16 w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-start shadow-card', !station.hasRafeeq && 'opacity-70')}
          >
            <StationLine station={station} km={km} />
          </button>
        ))}
      </div>
    </div>
  );
}

function StationLine({ station, km }: { station: ReturnType<typeof stationById> & {}; km: number }) {
  const { s, pick, num } = useI18n();
  const live = useStore(liveStore).byStation[station.id];
  return (
    <>
      <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl', station.hasRafeeq ? 'bg-teal-50 text-teal-700' : 'bg-navy-50 text-navy-400')}>
        {station.hasRafeeq ? <Fuel className="size-5" aria-hidden /> : <MapPin className="size-5" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-navy-800">{pick(station.nameAr, station.nameEn)}</span>
        <span className="block truncate text-xs text-navy-500">
          {station.hasRafeeq && live ? (
            <>
              <span className="me-1 inline-block size-1.5 rounded-full bg-teal-500 align-middle" />
              {s.home.pumpsFree(live.availablePumps, station.pumps.length)} · {s.home.queue(live.queueLength)}
            </>
          ) : (
            s.home.notRafeeq
          )}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-navy-500">
        <Timer className="size-3.5" aria-hidden />
        {num(km, 1)} {s.common.km}
      </span>
    </>
  );
}
