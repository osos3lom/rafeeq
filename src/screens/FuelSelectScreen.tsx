import { Bot, ChevronDown, Crown, Ticket } from 'lucide-react';
import { useState } from 'react';
import { router } from '../app/router';
import type { FuelRequest, FuelType, PaymentMethod, Vehicle } from '../domain/types';
import { useI18n } from '../i18n/i18n';
import { useOnline } from '../lib/connectivity';
import { useStore } from '../lib/store';
import { accountStore, defaultPaymentMethod, defaultVehicle, isPlus } from '../modules/account/accountStore';
import { activeVouchers, loyaltyStore } from '../modules/loyalty/loyalty';
import { estimatedLiters, fuelHold, startFuelVisit } from '../modules/orders/checkout';
import { computeBill } from '../modules/orders/pricing';
import { PaymentConfirmSheet, PaymentMethodPicker } from '../modules/payments/PaymentSheets';
import { stationById } from '../modules/stations/stations';
import { Button, Card, FuelBadge, Row, Screen, Segmented, Sheet, Toggle, cx } from '../ui/kit';
import { PaymentMark, Plate, usePaymentLabel } from '../ui/visuals';

const AMOUNTS = [50, 100, 150, 200];
const LITERS = [20, 40, 60];

export function FuelSelectScreen({ stationId, pump }: { stationId: string; pump: number }) {
  const { s, pick, num, money } = useI18n();
  const online = useOnline();
  const account = useStore(accountStore);
  const vouchers = activeVouchers(useStore(loyaltyStore));
  const payLabel = usePaymentLabel();
  const station = stationById(stationId)!;
  const pumpInfo = station.pumps.find((p) => p.number === pump)!;
  const user = account.user!;

  const [vehicle, setVehicle] = useState<Vehicle>(defaultVehicle(account)!);
  const [fuel, setFuel] = useState<FuelType>(pumpInfo.fuels.includes(vehicle.fuelType) ? vehicle.fuelType : pumpInfo.fuels[0]);
  const [mode, setMode] = useState<FuelRequest['mode']>('amount');
  const [sar, setSar] = useState(100);
  const [liters, setLiters] = useState(40);
  const [method, setMethod] = useState<PaymentMethod>(defaultPaymentMethod(account)!);
  const [usePoints, setUsePoints] = useState(false);
  const [sheet, setSheet] = useState<'vehicle' | 'payment' | 'confirm' | null>(null);

  const price = station.prices[fuel];
  const request: FuelRequest = mode === 'amount' ? { mode, sar } : mode === 'liters' ? { mode, liters } : { mode };
  const hold = fuelHold(request, price, vehicle.tankLiters);
  const estLiters = estimatedLiters(request, price, vehicle.tankLiters);

  const bill = computeBill({
    liters: estLiters,
    pricePerLiter: price,
    maxFuelCost: mode === 'amount' ? sar : undefined,
    fnbItems: [],
    pickupMode: null,
    plus: isPlus(user),
    vouchers,
    pointsBalance: user.pointsBalance,
    usePoints,
  });
  const pointsBlocks = Math.floor(user.pointsBalance / 100);

  const pay = async () => {
    const order = await startFuelVisit({ station, pumpNumber: pump, vehicle, fuelType: fuel, request, method, usePoints });
    setSheet(null);
    router.replace({ name: 'session', orderId: order.id });
  };

  const chip = (active: boolean) =>
    cx('min-h-12 flex-1 rounded-2xl text-base font-bold tabular-nums transition-colors', active ? 'bg-navy-800 text-white' : 'bg-white text-navy-700 shadow-card');

  return (
    <Screen
      title={s.fuelSelect.title}
      subtitle={`${pick(station.nameAr, station.nameEn)} · ${s.station.pump(pump)}`}
      footer={
        <>
          <Button block onClick={() => setSheet('confirm')} disabled={!online}>
            {online ? s.fuelSelect.pay(money(bill.total)) : s.common.offlinePay}
          </Button>
          <p className="mt-2 text-center text-[11px] leading-snug text-navy-400">{s.fuelSelect.authorizeNote}</p>
        </>
      }
    >
      {/* Vehicle */}
      <button onClick={() => account.vehicles.length > 1 && setSheet('vehicle')} className="mt-1 block w-full text-start">
        <Card className="flex items-center gap-3">
          <Plate plate={vehicle.plate} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-navy-800">
              {vehicle.make} {vehicle.model}
            </p>
            <p className="flex items-center gap-1 text-xs text-navy-500">
              <Bot className="size-3.5" aria-hidden /> {s.station.robotic} · {s.station.pump(pump)}
            </p>
          </div>
          {account.vehicles.length > 1 && <ChevronDown className="size-5 text-navy-400" aria-hidden />}
        </Card>
      </button>

      {/* Fuel type */}
      <p className="mb-2 mt-5 text-sm font-bold text-navy-700">{s.fuelSelect.fuelType}</p>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={s.fuelSelect.fuelType}>
        {(['91', '95', 'diesel'] as FuelType[]).map((f) => {
          const supported = pumpInfo.fuels.includes(f);
          return (
            <button
              key={f}
              role="radio"
              aria-checked={fuel === f}
              disabled={!supported}
              onClick={() => setFuel(f)}
              className={cx(
                'min-h-20 rounded-2xl bg-white p-2 shadow-card ring-2 transition-colors disabled:opacity-40',
                fuel === f ? 'ring-teal-600' : 'ring-transparent',
              )}
            >
              <FuelBadge fuel={f} />
              <p className="mt-1.5 text-sm font-bold tabular-nums text-navy-800">{num(station.prices[f], 2)}</p>
              <p className="text-[10px] text-navy-500">{s.station.perLiter}</p>
            </button>
          );
        })}
      </div>

      {/* Amount */}
      <p className="mb-2 mt-5 text-sm font-bold text-navy-700">{s.fuelSelect.amount}</p>
      <Segmented
        label={s.fuelSelect.amount}
        value={mode}
        onChange={setMode}
        options={[
          { value: 'amount', label: s.fuelSelect.modeAmount },
          { value: 'full', label: s.fuelSelect.modeFull },
          { value: 'liters', label: s.fuelSelect.modeLiters },
        ]}
      />
      <div className="mt-3">
        {mode === 'amount' && (
          <>
            <div className="flex gap-2">
              {AMOUNTS.map((a) => (
                <button key={a} className={chip(sar === a)} onClick={() => setSar(a)} aria-pressed={sar === a}>
                  {a}
                </button>
              ))}
            </div>
            <input
              type="range"
              min={20}
              max={300}
              step={5}
              value={sar}
              onChange={(e) => setSar(Number(e.target.value))}
              aria-label={s.fuelSelect.custom}
              className="mt-4 w-full accent-teal-600"
            />
          </>
        )}
        {mode === 'liters' && (
          <>
            <div className="flex gap-2">
              {LITERS.map((l) => (
                <button key={l} className={chip(liters === l)} onClick={() => setLiters(l)} aria-pressed={liters === l}>
                  {l} {s.common.litersShort}
                </button>
              ))}
            </div>
            <input
              type="range"
              min={5}
              max={Math.min(120, vehicle.tankLiters)}
              step={1}
              value={Math.min(liters, vehicle.tankLiters)}
              onChange={(e) => setLiters(Number(e.target.value))}
              aria-label={s.fuelSelect.modeLiters}
              className="mt-4 w-full accent-teal-600"
            />
          </>
        )}
        {mode === 'full' && <p className="rounded-2xl bg-teal-50 p-3 text-sm leading-relaxed text-teal-800">{s.fuelSelect.fullHold(money(hold))}</p>}

        <div className="mt-3 flex items-baseline justify-between px-1">
          <span className="text-3xl font-bold tabular-nums text-navy-800">
            {mode === 'liters' ? `${num(liters)} ${s.common.litersShort}` : mode === 'amount' ? money(sar) : money(hold)}
          </span>
          <span className="text-sm text-navy-500">
            {mode === 'liters' ? s.fuelSelect.approxCost(money(bill.fuelCost)) : s.fuelSelect.approxLiters(num(estLiters, 1))}
          </span>
        </div>
      </div>

      {/* Savings */}
      <Card className="mt-5 divide-y divide-navy-50 p-0">
        {isPlus(user) && (
          <div className="flex items-center gap-3 px-4 py-3">
            <Crown className="size-5 text-teal-600" aria-hidden />
            <span className="flex-1 text-sm text-navy-700">{s.fuelSelect.plusPerk}</span>
          </div>
        )}
        {vouchers.some((v) => v.kind === 'fuel_credit') && (
          <div className="flex items-center gap-3 px-4 py-3">
            <Ticket className="size-5 text-teal-600" aria-hidden />
            <span className="flex-1 text-sm text-navy-700">{s.fuelSelect.voucher}</span>
          </div>
        )}
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="flex-1 text-sm text-navy-700">
            {pointsBlocks > 0 ? s.fuelSelect.usePoints(Math.min(pointsBlocks, Math.floor(hold / 5)) * 100, money(Math.min(pointsBlocks, Math.floor(hold / 5)) * 5)) : s.fuelSelect.notEnoughPoints}
          </span>
          <Toggle checked={usePoints} onChange={setUsePoints} label={s.loyalty.redeem} />
        </div>
        {bill.discounts.length > 0 && (
          <div className="px-4 py-2">
            <Row label={s.receipt.fuel} value={money(bill.fuelCost)} muted />
            {bill.discounts.map((d) => (
              <Row key={d.code} label={pick(d.labelAr, d.labelEn)} value={`−${money(d.amount)}`} muted />
            ))}
            <Row label={s.receipt.total} value={money(bill.total)} strong />
          </div>
        )}
      </Card>

      {/* Payment method */}
      <p className="mb-2 mt-5 text-sm font-bold text-navy-700">{s.fuelSelect.payWith}</p>
      <button onClick={() => setSheet('payment')} className="block w-full text-start">
        <Card className="flex min-h-16 items-center gap-3">
          <PaymentMark type={method.type} />
          <span className="flex-1 font-semibold text-navy-800">{payLabel(method)}</span>
          <span className="text-sm font-semibold text-teal-700">{s.common.change}</span>
        </Card>
      </button>

      <Sheet open={sheet === 'vehicle'} onClose={() => setSheet(null)} title={s.fuelSelect.chooseVehicle}>
        <div className="space-y-2">
          {account.vehicles.map((v) => (
            <button
              key={v.id}
              onClick={() => {
                setVehicle(v);
                if (pumpInfo.fuels.includes(v.fuelType)) setFuel(v.fuelType);
                setSheet(null);
              }}
              className={cx('flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-start shadow-card ring-2', v.id === vehicle.id ? 'ring-teal-600' : 'ring-transparent')}
            >
              <Plate plate={v.plate} size="sm" />
              <span className="flex-1 font-semibold text-navy-800">
                {v.make} {v.model}
              </span>
              <FuelBadge fuel={v.fuelType} />
            </button>
          ))}
        </div>
      </Sheet>
      <PaymentMethodPicker open={sheet === 'payment'} methods={account.paymentMethods} selectedId={method.id} onSelect={setMethod} onClose={() => setSheet(null)} />
      <PaymentConfirmSheet open={sheet === 'confirm'} method={method} amount={hold} isHold onConfirm={pay} onClose={() => setSheet(null)} />
    </Screen>
  );
}
