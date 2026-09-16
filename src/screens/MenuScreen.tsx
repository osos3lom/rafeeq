import { Crown, Heart, Plus, RotateCcw, ShoppingBag } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { router } from '../app/router';
import type { MenuCategory, PaymentMethod, PickupMode } from '../domain/types';
import { useI18n } from '../i18n/i18n';
import { useOnline } from '../lib/connectivity';
import { useStore } from '../lib/store';
import { accountStore, defaultPaymentMethod, isPlus } from '../modules/account/accountStore';
import { cartStore, changeQty, linesCount, menuFor, setCartMenu, toFnbLines, toggleFavorite } from '../modules/fnb/cart';
import { activeVouchers, loyaltyStore } from '../modules/loyalty/loyalty';
import { attachFnbToVisit, orderById, ordersStore, placeFnbOnlyOrder } from '../modules/orders/checkout';
import { computeBill } from '../modules/orders/pricing';
import { PaymentConfirmSheet } from '../modules/payments/PaymentSheets';
import { stationById } from '../modules/stations/stations';
import { Button, Row, Screen, Segmented, Sheet, Stepper, Toggle, cx } from '../ui/kit';
import { toast } from '../ui/toast';
import { FoodTile, PaymentMark, usePaymentLabel } from '../ui/visuals';

const CATEGORIES: MenuCategory[] = ['coffee', 'cold', 'bakery', 'meals', 'snacks'];

export function MenuScreen({ stationId, orderId }: { stationId: string; orderId?: string }) {
  const { s, pick, num, money } = useI18n();
  const online = useOnline();
  const station = stationById(stationId)!;
  const menu = menuFor(station.menuId);
  const account = useStore(accountStore);
  const user = account.user!;
  const cart = useStore(cartStore);
  const vouchers = activeVouchers(useStore(loyaltyStore));
  useStore(ordersStore);
  const payLabel = usePaymentLabel();

  // A café order joins the active visit's bill only while the visit is still open.
  const visit = orderId ? orderById(orderId) : null;
  const attached = !!visit && (visit.status === 'pending' || visit.status === 'fueling');

  const [category, setCategory] = useState<MenuCategory>('coffee');
  const [cartOpen, setCartOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pickup, setPickup] = useState<PickupMode>(attached ? 'pump' : 'counter');
  const [usePoints, setUsePoints] = useState(false);
  const [busy, setBusy] = useState(false);
  const method: PaymentMethod = defaultPaymentMethod(account)!;
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (station.menuId) setCartMenu(station.menuId);
  }, [station.menuId]);

  const lines = toFnbLines(cart.lines, menu);
  const qtyOf = (id: string) => cart.lines.find((l) => l.itemId === id)?.qty ?? 0;
  const count = linesCount(cart.lines);
  const plusCoffee = isPlus(user) && attached;

  const bill = computeBill({
    liters: 0,
    pricePerLiter: null,
    fnbItems: lines,
    pickupMode: attached ? pickup : 'counter',
    plus: isPlus(user),
    vouchers,
    pointsBalance: user.pointsBalance,
    usePoints: !attached && usePoints,
  });
  // Plus free coffee only applies alongside a fill-up; preview it for attached orders.
  const previewDiscounts = plusCoffee
    ? computeBill({ liters: 1, pricePerLiter: 0, fnbItems: lines, pickupMode: pickup, plus: true, vouchers, pointsBalance: 0, usePoints: false }).discounts.filter((d) => d.code !== 'plus_liter')
    : bill.discounts;
  const previewTotal = Math.max(0, bill.fnbCost + bill.serviceFee - previewDiscounts.reduce((a, d) => a + d.amount, 0));

  const favorites = menu.filter((m) => cart.favorites.includes(m.id));
  const usual = cart.usual.filter((l) => menu.some((m) => m.id === l.itemId));

  const submit = async () => {
    if (attached) {
      setBusy(true);
      try {
        await attachFnbToVisit(visit!.id, cart.lines, pickup);
        toast(s.menu.added);
        setCartOpen(false);
        router.back();
      } finally {
        setBusy(false);
      }
    } else {
      setCartOpen(false);
      setConfirmOpen(true);
    }
  };

  const payStandalone = async () => {
    const order = await placeFnbOnlyOrder(station, cart.lines, method, usePoints);
    setConfirmOpen(false);
    toast(s.menu.orderPlaced);
    router.replace({ name: 'receipt', orderId: order.id, fresh: true });
  };

  const scrollTo = (c: MenuCategory) => {
    setCategory(c);
    sectionRefs.current[c]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!menu.length) {
    return (
      <Screen title={s.menu.title}>
        <p className="mt-10 text-center text-navy-500">{s.menu.noMenu}</p>
      </Screen>
    );
  }

  return (
    <Screen
      title={s.menu.title}
      subtitle={attached ? s.menu.attachedToVisit : pick(station.nameAr, station.nameEn)}
      bleed
      footer={
        count > 0 ? (
          <Button block onClick={() => setCartOpen(true)}>
            <ShoppingBag className="size-5" aria-hidden />
            {s.menu.viewCart} · {num(count)} · {money(previewTotal)}
          </Button>
        ) : undefined
      }
    >
      <nav className="sticky top-0 z-10 flex gap-2 overflow-x-auto bg-warm-bg px-4 pb-3 pt-1" aria-label={s.menu.title}>
        {CATEGORIES.filter((c) => menu.some((m) => m.category === c)).map((c) => (
          <button
            key={c}
            onClick={() => scrollTo(c)}
            className={cx(
              'min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors',
              category === c ? 'bg-navy-800 text-white' : 'bg-white text-navy-600 shadow-card',
            )}
          >
            {s.menu.categories[c]}
          </button>
        ))}
      </nav>

      <div className="px-4 pb-6">
        {(usual.length > 0 || favorites.length > 0) && (
          <section>
            <h2 className="mb-2 px-1 text-sm font-bold text-navy-700">{s.menu.favorites}</h2>
            {usual.length > 0 && (
              <button
                onClick={() => {
                  cartStore.set({ lines: usual });
                  setCartOpen(true);
                }}
                className="mb-2 flex min-h-14 w-full items-center gap-3 rounded-2xl bg-teal-50 px-4 text-start"
              >
                <RotateCcw className="size-5 text-teal-700" aria-hidden />
                <span className="flex-1">
                  <span className="block text-sm font-bold text-teal-800">{s.menu.reorder}</span>
                  <span className="block truncate text-xs text-teal-700">
                    {toFnbLines(usual, menu).map((l) => `${l.qty}× ${pick(l.nameAr, l.nameEn)}`).join('، ')}
                  </span>
                </span>
              </button>
            )}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {favorites.map((item) => (
                <button key={item.id} onClick={() => changeQty(item.id, 1)} className="flex w-28 shrink-0 flex-col items-center rounded-2xl bg-white p-2 shadow-card">
                  <FoodTile art={item.image} size={52} />
                  <span className="mt-1 line-clamp-1 text-xs font-semibold text-navy-800">{pick(item.nameAr, item.nameEn)}</span>
                  <span className="text-[11px] tabular-nums text-navy-500">{money(item.price)}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {CATEGORIES.map((c) => {
          const items = menu.filter((m) => m.category === c);
          if (!items.length) return null;
          return (
            <section key={c} ref={(el) => void (sectionRefs.current[c] = el)} className="scroll-mt-16">
              <h2 className="mb-2 mt-5 px-1 text-sm font-bold text-navy-700">{s.menu.categories[c]}</h2>
              <ul className="space-y-2">
                {items.map((item) => {
                  const qty = qtyOf(item.id);
                  const fav = cart.favorites.includes(item.id);
                  return (
                    <li key={item.id} className="flex gap-3 rounded-3xl bg-white p-3 shadow-card">
                      <FoodTile art={item.image} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold leading-snug text-navy-800">{pick(item.nameAr, item.nameEn)}</p>
                          <button
                            onClick={() => toggleFavorite(item.id)}
                            aria-pressed={fav}
                            aria-label={pick(item.nameAr, item.nameEn)}
                            className="-m-2 grid size-10 shrink-0 place-items-center"
                          >
                            <Heart className={cx('size-5', fav ? 'fill-rose-500 text-rose-500' : 'text-navy-300')} aria-hidden />
                          </button>
                        </div>
                        <p className="line-clamp-1 text-xs text-navy-500">{pick(item.descAr, item.descEn)}</p>
                        {plusCoffee && c === 'coffee' && (
                          <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-teal-700">
                            <Crown className="size-3" aria-hidden />
                            {s.menu.plusFree}
                          </p>
                        )}
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-sm font-bold tabular-nums text-navy-800">
                            {money(item.price)}
                            <span className="ms-2 text-[11px] font-normal text-navy-400">
                              {item.calories} {s.menu.cal} · {s.menu.prep(item.prepMinutes)}
                            </span>
                          </span>
                          {qty > 0 ? (
                            <Stepper qty={qty} onChange={(d) => changeQty(item.id, d)} labelMinus="−" labelPlus="+" />
                          ) : (
                            <button
                              onClick={() => changeQty(item.id, 1)}
                              aria-label={`${s.common.add} ${pick(item.nameAr, item.nameEn)}`}
                              className="grid size-11 place-items-center rounded-full bg-teal-600 text-white"
                            >
                              <Plus className="size-5" aria-hidden />
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <Sheet open={cartOpen} onClose={() => setCartOpen(false)} title={s.menu.cart}>
        {lines.length === 0 ? (
          <p className="py-8 text-center text-navy-500">{s.menu.emptyCart}</p>
        ) : (
          <>
            <ul className="space-y-2">
              {lines.map((l) => (
                <li key={l.itemId} className="flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow-card">
                  <FoodTile art={menu.find((m) => m.id === l.itemId)!.image} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy-800">{pick(l.nameAr, l.nameEn)}</p>
                    <p className="text-xs tabular-nums text-navy-500">{money(l.unitPrice * l.qty)}</p>
                  </div>
                  <Stepper qty={l.qty} onChange={(d) => changeQty(l.itemId, d)} labelMinus="−" labelPlus="+" />
                </li>
              ))}
            </ul>

            <p className="mb-2 mt-4 text-sm font-bold text-navy-700">{s.menu.pickup}</p>
            <Segmented
              label={s.menu.pickup}
              value={attached ? pickup : 'counter'}
              onChange={setPickup}
              options={[
                { value: 'pump', label: attached ? s.menu.pickupPump(visit!.pumpNumber!) : s.menu.pickupPumpShort, disabled: !attached },
                { value: 'counter', label: s.menu.pickupCounter },
              ]}
            />
            {!attached && <p className="mt-1.5 px-1 text-xs text-navy-400">{s.menu.pumpOnlyDuringVisit}</p>}

            {!attached && user.pointsBalance >= 100 && (
              <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-card">
                <span className="flex-1 text-sm text-navy-700">{s.loyalty.redeem} · {num(user.pointsBalance)} {s.common.pts}</span>
                <Toggle checked={usePoints} onChange={setUsePoints} label={s.loyalty.redeem} />
              </div>
            )}

            <div className="mt-3 rounded-2xl bg-white px-4 py-2 shadow-card">
              <Row label={s.receipt.subtotal} value={money(bill.fnbCost)} muted />
              {bill.serviceFee > 0 && <Row label={s.menu.serviceFee} value={money(bill.serviceFee)} muted />}
              {previewDiscounts.map((d) => (
                <Row key={d.code} label={pick(d.labelAr, d.labelEn)} value={`−${money(d.amount)}`} muted />
              ))}
              <Row label={s.receipt.total} value={money(previewTotal)} strong />
            </div>

            {!attached && (
              <div className="mt-3 flex items-center gap-3 px-1 text-sm text-navy-600">
                <PaymentMark type={method.type} />
                {payLabel(method)}
              </div>
            )}

            <Button block className="mt-4" onClick={submit} loading={busy} disabled={!online}>
              {!online ? s.common.offlinePay : attached ? s.menu.addToBill(money(previewTotal)) : s.menu.payNow(money(bill.total))}
            </Button>
          </>
        )}
      </Sheet>

      <PaymentConfirmSheet open={confirmOpen} method={method} amount={bill.total} onConfirm={payStandalone} onClose={() => setConfirmOpen(false)} />
    </Screen>
  );
}
