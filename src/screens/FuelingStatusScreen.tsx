import { Check, Coffee, Plus, Radio, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { router } from '../app/router';
import { useI18n } from '../i18n/i18n';
import { useOnline } from '../lib/connectivity';
import { useNow } from '../lib/useNow';
import { useStore } from '../lib/store';
import { accountStore } from '../modules/account/accountStore';
import { cartStore, itemById, linesTotal, menuFor, toFnbLines } from '../modules/fnb/cart';
import type { PumpPhase } from '../modules/fueling/stationLink';
import {
  attachFnbToVisit,
  cancelVisit,
  finalizeVisit,
  fnbStageAt,
  orderById,
  ordersStore,
  previewVisitBill,
  stopFueling,
} from '../modules/orders/checkout';
import { stationById } from '../modules/stations/stations';
import { Button, Card, FuelBadge, Screen, Sheet, cx } from '../ui/kit';
import { toast } from '../ui/toast';
import { FoodTile, FuelGauge, Plate } from '../ui/visuals';

const PHASES: PumpPhase[] = ['waiting', 'fueling', 'done'];

export function FuelingStatusScreen({ orderId }: { orderId: string }) {
  const { s, pick, num, money } = useI18n();
  const { snapshots, linkOnline } = useStore(ordersStore);
  const { vehicles } = useStore(accountStore);
  const cart = useStore(cartStore);
  const order = orderById(orderId);
  const [busy, setBusy] = useState<'finish' | 'cancel' | 'stop' | 'usual' | null>(null);
  const [confirm, setConfirm] = useState<'cancel' | 'stop' | null>(null);
  const now = useNow();
  const online = useOnline();

  useEffect(() => {
    // Order already settled (e.g. reopened from history) — show its receipt instead.
    if (order?.status === 'complete') router.replace({ name: 'receipt', orderId });
    if (order?.status === 'cancelled') router.tab('home');
  }, [order?.status, orderId]);

  if (!order || order.status === 'complete' || order.status === 'cancelled') return null;

  const station = stationById(order.stationId)!;
  const vehicle = vehicles.find((v) => v.id === order.vehicleId);
  const snap = order.pumpSessionId ? snapshots[order.pumpSessionId] : null;
  const phase: PumpPhase = snap?.phase ?? 'waiting';
  const phaseIdx = PHASES.indexOf(phase);
  const progress = snap ? snap.liters / snap.targetLiters : 0;
  const bill = previewVisitBill(orderId);
  const fnbStage = fnbStageAt(order, now);
  const menu = menuFor(station.menuId);
  const usual = cart.usual.filter((l) => menu.some((m) => m.id === l.itemId));
  const usualLines = toFnbLines(usual, menu);

  const finish = async () => {
    setBusy('finish');
    try {
      await finalizeVisit(orderId);
      router.replace({ name: 'receipt', orderId, fresh: true });
    } finally {
      setBusy(null);
    }
  };

  const addUsual = async () => {
    setBusy('usual');
    try {
      await attachFnbToVisit(orderId, usual, 'pump');
      toast(s.menu.added);
    } finally {
      setBusy(null);
    }
  };

  const runConfirm = async () => {
    const action = confirm;
    setConfirm(null);
    setBusy(action);
    try {
      if (action === 'cancel') {
        await cancelVisit(orderId);
        router.tab('home');
      } else if (action === 'stop') {
        await stopFueling(orderId);
      }
    } finally {
      setBusy(null);
    }
  };

  const stepLabels = [s.session.stepWaiting, s.session.stepFueling, s.session.stepDone];

  return (
    <Screen
      title={s.session.title}
      subtitle={`${pick(station.nameAr, station.nameEn)} · ${s.station.pump(order.pumpNumber!)}`}
      onBack={() => router.tab('home')}
      actions={
        <span
          className={cx('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', linkOnline ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-800')}
          aria-live="polite"
        >
          {linkOnline ? <Radio className="size-3.5" aria-hidden /> : <WifiOff className="size-3.5" aria-hidden />}
          {linkOnline ? s.common.live : s.common.reconnecting}
        </span>
      }
      footer={
        phase === 'done' ? (
          <Button block onClick={finish} loading={busy === 'finish'} disabled={!online}>
            <Check className="size-5" aria-hidden />
            {online ? `${s.session.finish} · ${money(bill.total)}` : s.common.offlinePay}
          </Button>
        ) : phase === 'fueling' ? (
          <Button block variant="ghost" onClick={() => setConfirm('stop')} loading={busy === 'stop'}>
            {s.session.stop}
          </Button>
        ) : (
          <Button block variant="danger" onClick={() => setConfirm('cancel')} loading={busy === 'cancel'}>
            {s.session.cancel}
          </Button>
        )
      }
    >
      {/* Steps */}
      <ol className="mt-2 flex items-start gap-2" aria-label={s.session.title}>
        {PHASES.map((p, i) => {
          const state = i < phaseIdx || phase === 'done' ? 'done' : i === phaseIdx ? 'current' : 'todo';
          return (
            <li key={p} className="flex flex-1 flex-col items-center gap-1.5" aria-current={state === 'current' ? 'step' : undefined}>
              <div className="flex w-full items-center gap-2">
                <span
                  className={cx(
                    'grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold transition-colors duration-500',
                    state === 'done' && 'bg-teal-600 text-white',
                    state === 'current' && 'bg-navy-800 text-white ring-4 ring-navy-100',
                    state === 'todo' && 'bg-navy-100 text-navy-400',
                  )}
                >
                  {state === 'done' ? <Check className="size-4" aria-hidden /> : i + 1}
                </span>
                {i < 2 && <span className={cx('h-1 flex-1 rounded-full transition-colors duration-500', i < phaseIdx ? 'bg-teal-600' : 'bg-navy-100')} />}
              </div>
              <span className={cx('w-full text-start text-xs font-semibold', state === 'todo' ? 'text-navy-400' : 'text-navy-800')}>{stepLabels[i]}</span>
            </li>
          );
        })}
      </ol>

      {/* Gauge */}
      <Card className="mt-4 px-5 pb-5 pt-6">
        <FuelGauge value={progress} size={300} active={phase === 'fueling'}>
          <span className="text-5xl font-bold tabular-nums text-navy-800">{num(snap?.liters ?? 0, 1)}</span>
          <span className="text-sm text-navy-500">
            {s.session.liters}{' '}
            {order.fuelRequest?.mode === 'full' ? `· ${s.session.fullTank}` : snap ? s.session.target(num(snap.targetLiters, 1)) : ''}
          </span>
        </FuelGauge>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
            {order.fuelType && <FuelBadge fuel={order.fuelType} />}
            {vehicle && <Plate plate={vehicle.plate} size="sm" />}
          </div>
          <span className="whitespace-nowrap text-xl font-bold tabular-nums text-navy-800">{money(snap?.amountSar ?? 0)}</span>
        </div>
        <p className="mt-4 rounded-2xl bg-warm-bg px-4 py-3 text-center text-sm font-medium text-navy-700" aria-live="polite">
          {snap ? s.session.stage[snap.stage] : s.session.stage.awaiting_vehicle}
        </p>
      </Card>

      {/* Café — the cross-sell moment, never blocking the fuel flow */}
      {order.fnbItems.length > 0 && fnbStage && (
        <Card className="mt-3">
          <div className="flex items-center justify-between">
            <p className="font-bold text-navy-800">{s.session.fnbTitle}</p>
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
              {fnbStage === 'on_the_way' ? s.session.fnbStage.on_the_way(order.pumpNumber!) : s.session.fnbStage[fnbStage]}
            </span>
          </div>
          <p className="mt-1 text-sm text-navy-500">{order.fnbItems.map((l) => `${l.qty}× ${pick(l.nameAr, l.nameEn)}`).join('، ')}</p>
          {phase !== 'done' && (
            <Button variant="soft" size="md" className="mt-3" onClick={() => router.push({ name: 'menu', stationId: station.id, orderId })}>
              <Plus className="size-4" aria-hidden />
              {s.session.browseMenu}
            </Button>
          )}
        </Card>
      )}

      {order.fnbItems.length === 0 && station.menuId && phase !== 'done' && (
        <Card className="mt-3">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#EFE6DD] text-[#6B4A32]">
              <Coffee className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-bold text-navy-800">{s.session.preorderTitle}</p>
              <p className="text-xs text-navy-500">{s.session.preorderBody}</p>
            </div>
          </div>

          {usualLines.length > 0 && (
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-warm-bg p-3">
              <div className="flex -space-x-3 rtl:space-x-reverse">
                {usualLines.slice(0, 2).map((l) => (
                  <div key={l.itemId} className="rounded-2xl ring-2 ring-warm-bg">
                    <FoodTile art={itemById(l.itemId)!.image} size={40} />
                  </div>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-navy-500">{s.session.usual}</p>
                <p className="truncate text-sm font-semibold text-navy-800">{usualLines.map((l) => pick(l.nameAr, l.nameEn)).join(' + ')}</p>
                <p className="text-xs tabular-nums text-navy-500">{money(linesTotal(usualLines))}</p>
              </div>
              <Button size="md" onClick={addUsual} loading={busy === 'usual'}>
                <Plus className="size-4" aria-hidden />
                {s.session.addUsual}
              </Button>
            </div>
          )}
          <Button block variant="soft" size="md" className="mt-3" onClick={() => router.push({ name: 'menu', stationId: station.id, orderId })}>
            {s.session.browseMenu}
          </Button>
        </Card>
      )}

      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title={confirm === 'cancel' ? s.session.cancel : s.session.stop}>
        <p className="text-navy-600">{confirm === 'cancel' ? s.session.cancelConfirm : s.session.stopConfirm}</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => setConfirm(null)}>
            {s.common.back}
          </Button>
          <Button variant={confirm === 'cancel' ? 'secondary' : 'primary'} onClick={runConfirm}>
            {confirm === 'cancel' ? s.session.cancel : s.session.stop}
          </Button>
        </div>
      </Sheet>
    </Screen>
  );
}
