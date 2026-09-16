import { CircleCheck, Coffee, Crown, Fuel, Share2 } from 'lucide-react';
import { router } from '../app/router';
import { useI18n } from '../i18n/i18n';
import { useNow } from '../lib/useNow';
import { useStore } from '../lib/store';
import { accountStore } from '../modules/account/accountStore';
import { fnbStageAt, orderById, ordersStore } from '../modules/orders/checkout';
import { stationById } from '../modules/stations/stations';
import { Button, Card, FuelBadge, Pill, Row, Screen, cx } from '../ui/kit';
import { toast } from '../ui/toast';
import { PaymentMark, Plate, usePaymentLabel } from '../ui/visuals';

export function ReceiptScreen({ orderId, fresh }: { orderId: string; fresh?: boolean }) {
  const { s, pick, num, money, date } = useI18n();
  useStore(ordersStore);
  const { user, vehicles } = useStore(accountStore);
  const payLabel = usePaymentLabel();
  const order = orderById(orderId);
  const now = useNow();

  if (!order) return null;
  const station = stationById(order.stationId)!;
  const vehicle = vehicles.find((v) => v.id === order.vehicleId);
  const fnbStage = fnbStageAt(order, now);
  const cancelled = order.status === 'cancelled';

  const share = async () => {
    const text = s.receipt.shareText(money(order.total), pick(station.nameAr, station.nameEn)) + ` · ${order.invoiceNo}`;
    try {
      if (navigator.share) await navigator.share({ title: s.receipt.title, text });
      else {
        await navigator.clipboard.writeText(text);
        toast(s.receipt.copied);
      }
    } catch {
      // user dismissed the share sheet
    }
  };

  return (
    <Screen
      title={s.receipt.title}
      back={!fresh}
      actions={
        !cancelled && (
          <button onClick={share} aria-label={s.receipt.share} className="grid size-11 place-items-center rounded-full bg-white text-navy-700 shadow-card">
            <Share2 className="size-5" aria-hidden />
          </button>
        )
      }
      footer={
        fresh ? (
          <Button block variant="secondary" onClick={() => router.tab('home')}>
            {s.receipt.home}
          </Button>
        ) : undefined
      }
    >
      {fresh && (
        <div className="animate-rise flex flex-col items-center pb-2 pt-3 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-teal-50">
            <CircleCheck className="size-9 text-teal-600" aria-hidden />
          </span>
          <p className="mt-3 text-lg font-bold text-navy-800">{s.receipt.paid}</p>
          <p className="text-4xl font-bold tabular-nums text-navy-800">{money(order.total)}</p>
          {order.pointsEarned > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <Pill tone="teal">
                {user && user.subscriptionTier !== 'none' && <Crown className="size-3" aria-hidden />}
                {s.receipt.pointsEarned(order.pointsEarned)}
              </Pill>
              {user && <span className="text-xs text-navy-500">{s.receipt.newBalance(num(user.pointsBalance))}</span>}
            </div>
          )}
        </div>
      )}

      {fnbStage && !cancelled && (
        <Card className="mt-3 flex items-center gap-3 bg-teal-600 text-white">
          <Coffee className="size-6 shrink-0" aria-hidden />
          <p className="flex-1 font-semibold">
            {fnbStage === 'on_the_way' ? s.session.fnbStage.on_the_way(order.pumpNumber!) : s.session.fnbStage[fnbStage]}
          </p>
        </Card>
      )}

      <Card className="relative mt-3 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-dashed border-navy-100 pb-3">
          <div>
            <p className="font-bold text-navy-800">{pick(station.nameAr, station.nameEn)}</p>
            <p className="text-xs text-navy-500">{s.receipt.seller}</p>
          </div>
          {cancelled && <Pill tone="amber">{s.receipt.cancelled}</Pill>}
        </div>

        <div className="border-b border-dashed border-navy-100 py-2">
          <Row label={s.receipt.invoice} value={<bdi dir="ltr">{order.invoiceNo}</bdi>} muted />
          <Row label={s.receipt.date} value={date(order.completedAt ?? order.createdAt, true)} muted />
          {order.pumpNumber && <Row label={s.receipt.pump} value={order.pumpNumber} muted />}
          {vehicle && <Row label={s.receipt.vehicle} value={<Plate plate={vehicle.plate} size="sm" />} muted />}
        </div>

        {order.fuelType && (
          <div className="border-b border-dashed border-navy-100 py-3">
            <p className="mb-1 flex items-center gap-2 text-sm font-bold text-navy-800">
              <Fuel className="size-4 text-teal-600" aria-hidden />
              {s.receipt.fuel}
              <FuelBadge fuel={order.fuelType} long />
            </p>
            <Row label={`${num(order.fuelAmount, 2)} ${s.common.liters} × ${num(order.pricePerLiter ?? 0, 2)}`} value={money(order.fuelCost)} />
          </div>
        )}

        {order.fnbItems.length > 0 && (
          <div className="border-b border-dashed border-navy-100 py-3">
            <p className="mb-1 flex items-center gap-2 text-sm font-bold text-navy-800">
              <Coffee className="size-4 text-teal-600" aria-hidden />
              {s.receipt.fnb}
              <span className="text-xs font-normal text-navy-500">· {order.pickupMode === 'pump' ? s.menu.pickupPumpShort : s.menu.pickupCounter}</span>
            </p>
            {order.fnbItems.map((l) => (
              <Row key={l.itemId} label={`${l.qty}× ${pick(l.nameAr, l.nameEn)}`} value={money(l.unitPrice * l.qty)} />
            ))}
            {order.serviceFee > 0 && <Row label={s.menu.serviceFee} value={money(order.serviceFee)} />}
          </div>
        )}

        {order.discounts.length > 0 && (
          <div className="border-b border-dashed border-navy-100 py-3">
            <p className="mb-1 text-sm font-bold text-navy-800">{s.receipt.discounts}</p>
            {order.discounts.map((d, i) => (
              <Row key={i} label={pick(d.labelAr, d.labelEn)} value={<span className="text-teal-700">−{money(d.amount)}</span>} />
            ))}
          </div>
        )}

        <div className="pt-3">
          <Row label={s.receipt.total} value={money(order.total)} strong />
          <p className="text-xs text-navy-500">{s.receipt.vatIncluded(money(order.vat))}</p>
        </div>

        <div className={cx('mt-4 flex items-center gap-3 rounded-2xl bg-warm-bg p-3', cancelled && 'opacity-60')}>
          <PaymentMark type={order.paymentMethod} />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-navy-800">{payLabel({ type: order.paymentMethod })}</p>
            {order.paymentRef && (
              <p className="text-xs text-navy-500">
                {s.receipt.paymentRef} <bdi dir="ltr">{order.paymentRef}</bdi>
              </p>
            )}
          </div>
        </div>
      </Card>
    </Screen>
  );
}

export function ReceiptsScreen() {
  const { s, pick, money, date } = useI18n();
  const { orders } = useStore(ordersStore);
  const past = orders.filter((o) => o.status === 'complete' || o.status === 'cancelled');
  return (
    <Screen title={s.receipt.history}>
      {past.length === 0 && <p className="mt-10 text-center text-navy-500">{s.receipt.noHistory}</p>}
      <div className="space-y-2 pt-1">
        {past.map((o) => {
          const st = stationById(o.stationId)!;
          return (
            <button
              key={o.id}
              onClick={() => router.push({ name: 'receipt', orderId: o.id })}
              className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-start shadow-card"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-700">
                {o.fuelType ? <Fuel className="size-5" aria-hidden /> : <Coffee className="size-5" aria-hidden />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-navy-800">{pick(st.nameAr, st.nameEn)}</span>
                <span className="block text-xs text-navy-500">
                  {date(o.createdAt, true)} · {o.status === 'cancelled' ? s.receipt.cancelled : o.fuelType ? s.fuel[o.fuelType] : s.receipt.fnbOnly}
                </span>
              </span>
              <span className="font-bold tabular-nums text-navy-800">{money(o.total)}</span>
            </button>
          );
        })}
      </div>
    </Screen>
  );
}
