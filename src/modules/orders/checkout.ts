import type { FnbLine, FuelRequest, FuelType, Order, PaymentMethod, PickupMode, Station, Vehicle } from '../../domain/types';
import { createStore, round2, uid } from '../../lib/store';
import { accountStore, isPlus } from '../account/accountStore';
import { type CartLine, clearCart, menuFor, rememberUsual, toFnbLines } from '../fnb/cart';
import { type PumpSnapshot, stationLink } from '../fueling/stationLink';
import { activeVouchers, creditOrder, loyaltyStore, markVoucherUsed } from '../loyalty/loyalty';
import { payments } from '../payments/gateway';
import { pinPump, stationById, unpinPump, clearArrival } from '../stations/stations';
import { computeBill } from './pricing';

// Orders module: the only place where fueling, F&B, payments and loyalty meet.

interface OrdersState {
  orders: Order[];
  activeOrderId: string | null;
  /** Latest pump snapshot per session (persisted — shown while reconnecting). */
  snapshots: Record<string, PumpSnapshot>;
  linkOnline: boolean;
  /** Whether the driver opted to redeem points on the active visit. */
  usePoints: Record<string, boolean>;
}

export const ordersStore = createStore<OrdersState>(
  { orders: [], activeOrderId: null, snapshots: {}, linkOnline: true, usePoints: {} },
  'orders',
);

const patchOrder = (id: string, patch: Partial<Order>) =>
  ordersStore.set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));

export const orderById = (id: string) => ordersStore.get().orders.find((o) => o.id === id) ?? null;

const invoiceNo = () => `RFQ-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

export const plateLabel = (v: Vehicle) => `${v.plate.letters.join(' ')} ${v.plate.digits}`;

/** Maximum amount the pump may dispense — this is what gets authorized. */
export function fuelHold(request: FuelRequest, price: number, tankLiters: number) {
  if (request.mode === 'amount') return request.sar;
  if (request.mode === 'liters') return round2(request.liters * price);
  return Math.min(400, Math.ceil((tankLiters * price) / 10) * 10);
}

export function estimatedLiters(request: FuelRequest, price: number, tankLiters: number) {
  if (request.mode === 'amount') return request.sar / price;
  if (request.mode === 'liters') return request.liters;
  return tankLiters * 0.64;
}

// ---- Fuel visit ------------------------------------------------------------------

export async function startFuelVisit(p: {
  station: Station;
  pumpNumber: number;
  vehicle: Vehicle;
  fuelType: FuelType;
  request: FuelRequest;
  method: PaymentMethod;
  usePoints: boolean;
}): Promise<Order> {
  const user = accountStore.get().user!;
  const price = p.station.prices[p.fuelType];
  const hold = fuelHold(p.request, price, p.vehicle.tankLiters);
  const id = uid('ord');

  const auth = await payments.authorize(p.method, hold, id);

  const order: Order = {
    id,
    invoiceNo: invoiceNo(),
    userId: user.id,
    stationId: p.station.id,
    vehicleId: p.vehicle.id,
    pumpNumber: p.pumpNumber,
    fuelType: p.fuelType,
    fuelRequest: p.request,
    pricePerLiter: price,
    fuelAmount: 0,
    fuelCost: 0,
    fnbItems: [],
    fnbCost: 0,
    fnbPlacedAt: null,
    pickupMode: null,
    serviceFee: 0,
    discounts: [],
    pointsToRedeem: 0,
    voucherId: null,
    total: 0,
    vat: 0,
    paymentMethod: p.method.type,
    paymentAuthId: auth.authId,
    authorizedAmount: auth.amount,
    paymentRef: null,
    pumpSessionId: null,
    status: 'pending',
    pointsEarned: 0,
    pointsRedeemed: 0,
    createdAt: Date.now(),
    completedAt: null,
  };

  const { sessionId } = await stationLink.startSession({
    stationId: p.station.id,
    pumpNumber: p.pumpNumber,
    fuelType: p.fuelType,
    request: p.request,
    pricePerLiter: price,
    tankLiters: p.vehicle.tankLiters,
    maxAmountSar: hold,
    plate: plateLabel(p.vehicle),
  });

  pinPump(p.station.id, p.pumpNumber);
  ordersStore.set((s) => ({
    orders: [{ ...order, pumpSessionId: sessionId }, ...s.orders],
    activeOrderId: id,
    usePoints: { ...s.usePoints, [id]: p.usePoints },
  }));
  clearArrival();
  watchActiveVisit();
  return orderById(id)!;
}

let unsubscribe: (() => void) | null = null;

/** Subscribes to the active visit's pump events. Safe to call repeatedly (e.g. on app start). */
export function watchActiveVisit() {
  unsubscribe?.();
  unsubscribe = null;
  const { activeOrderId } = ordersStore.get();
  const order = activeOrderId ? orderById(activeOrderId) : null;
  if (!order?.pumpSessionId || order.status === 'complete' || order.status === 'cancelled') return;

  const sessionId = order.pumpSessionId;
  unsubscribe = stationLink.subscribe(sessionId, (event) => {
    if (event.type === 'connection') {
      ordersStore.set({ linkOnline: event.online });
      return;
    }
    const snap = event.data;
    ordersStore.set((s) => ({ snapshots: { ...s.snapshots, [sessionId]: snap }, linkOnline: true }));
    const current = orderById(order.id);
    if (!current) return;
    const patch: Partial<Order> = { fuelAmount: snap.liters };
    if (snap.phase !== 'waiting' && current.status === 'pending') patch.status = 'fueling';
    patchOrder(order.id, patch);
  });
}

export const snapshotFor = (order: Order | null) =>
  order?.pumpSessionId ? (ordersStore.get().snapshots[order.pumpSessionId] ?? null) : null;

export async function stopFueling(orderId: string) {
  const o = orderById(orderId);
  if (o?.pumpSessionId) await stationLink.stop(o.pumpSessionId);
}

export async function cancelVisit(orderId: string) {
  const o = orderById(orderId);
  if (!o) return;
  if (o.pumpSessionId) await stationLink.cancel(o.pumpSessionId);
  await payments.void(o.paymentAuthId);
  unsubscribe?.();
  unsubscribe = null;
  if (o.pumpNumber) unpinPump(o.stationId, o.pumpNumber);
  patchOrder(orderId, { status: 'cancelled', completedAt: Date.now() });
  ordersStore.set({ activeOrderId: null });
}

// ---- F&B -----------------------------------------------------------------------

function billFor(order: Pick<Order, 'fuelAmount' | 'pricePerLiter' | 'fuelRequest' | 'fnbItems' | 'pickupMode'>, usePoints: boolean) {
  const { user } = accountStore.get();
  return computeBill({
    liters: order.fuelAmount,
    pricePerLiter: order.pricePerLiter,
    maxFuelCost: order.fuelRequest?.mode === 'amount' ? order.fuelRequest.sar : undefined,
    fnbItems: order.fnbItems,
    pickupMode: order.pickupMode,
    plus: isPlus(user),
    vouchers: activeVouchers(loyaltyStore.get()),
    pointsBalance: user?.pointsBalance ?? 0,
    usePoints,
  });
}

function mergeLines(a: FnbLine[], b: FnbLine[]) {
  const out = a.map((l) => ({ ...l }));
  for (const line of b) {
    const hit = out.find((l) => l.itemId === line.itemId);
    if (hit) hit.qty += line.qty;
    else out.push({ ...line });
  }
  return out;
}

/** Adds café items to the active visit's bill by incrementing the existing authorization. */
export async function attachFnbToVisit(orderId: string, cartLines: CartLine[], pickupMode: PickupMode) {
  const order = orderById(orderId)!;
  const station = stationById(order.stationId)!;
  const lines = toFnbLines(cartLines, menuFor(station.menuId));
  const addedCost = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const fee = pickupMode === 'pump' && order.serviceFee === 0 ? 4 : 0;

  const { amount } = await payments.increment(order.paymentAuthId, round2(addedCost + fee));
  const fnbItems = mergeLines(order.fnbItems, lines);
  patchOrder(orderId, {
    fnbItems,
    fnbCost: round2(fnbItems.reduce((s, l) => s + l.unitPrice * l.qty, 0)),
    pickupMode,
    serviceFee: pickupMode === 'pump' ? 4 : order.serviceFee,
    fnbPlacedAt: Date.now(),
    authorizedAmount: amount,
  });
  rememberUsual(cartLines);
  clearCart();
}

/** Café-only order (no active visit): charged immediately, picked up at the counter. */
export async function placeFnbOnlyOrder(station: Station, cartLines: CartLine[], method: PaymentMethod, usePoints: boolean) {
  const user = accountStore.get().user!;
  const lines = toFnbLines(cartLines, menuFor(station.menuId));
  const id = uid('ord');
  const draft = { fuelAmount: 0, pricePerLiter: null, fuelRequest: null, fnbItems: lines, pickupMode: 'counter' as const };
  const bill = billFor(draft, usePoints);

  const capture = await payments.charge(method, bill.total, id);
  const order: Order = {
    ...draft,
    id,
    invoiceNo: invoiceNo(),
    userId: user.id,
    stationId: station.id,
    vehicleId: null,
    pumpNumber: null,
    fuelType: null,
    fuelCost: 0,
    fnbCost: bill.fnbCost,
    fnbPlacedAt: Date.now(),
    serviceFee: 0,
    discounts: bill.discounts,
    pointsToRedeem: bill.pointsRedeemed,
    voucherId: bill.voucherId,
    total: bill.total,
    vat: bill.vat,
    paymentMethod: method.type,
    paymentAuthId: capture.authId,
    authorizedAmount: capture.amount,
    paymentRef: capture.reference,
    pumpSessionId: null,
    status: 'complete',
    pointsEarned: bill.pointsEarned,
    pointsRedeemed: bill.pointsRedeemed,
    createdAt: Date.now(),
    completedAt: Date.now(),
  };
  ordersStore.set((s) => ({ orders: [order, ...s.orders] }));
  settleLoyalty(order, station);
  rememberUsual(cartLines);
  clearCart();
  return order;
}

// ---- Settlement --------------------------------------------------------------

function settleLoyalty(order: Order, station: Station) {
  if (order.voucherId) markVoucherUsed(order.voucherId, order.id);
  const what = [order.fuelType ? (order.fuelType === 'diesel' ? 'Diesel' : order.fuelType) : null, ...order.fnbItems.map((l) => l.nameEn)]
    .filter(Boolean)
    .join(' + ');
  const whatAr = [order.fuelType ? (order.fuelType === 'diesel' ? 'ديزل' : order.fuelType) : null, ...order.fnbItems.map((l) => l.nameAr)]
    .filter(Boolean)
    .join(' + ');
  creditOrder(order.id, order.pointsEarned, order.pointsRedeemed, `${station.nameAr} · ${whatAr}`, `${station.nameEn} · ${what}`);
}

/** Current bill for the active visit — what the driver will be charged if they finish now. */
export function previewVisitBill(orderId: string) {
  const o = orderById(orderId)!;
  return billFor(o, ordersStore.get().usePoints[orderId] ?? false);
}

/** Captures the final amount (fuel actually dispensed + café) — one transaction, one receipt. */
export async function finalizeVisit(orderId: string) {
  const o = orderById(orderId)!;
  const station = stationById(o.stationId)!;
  const snap = snapshotFor(o);
  const withFuel = { ...o, fuelAmount: snap?.liters ?? o.fuelAmount };
  const bill = billFor(withFuel, ordersStore.get().usePoints[orderId] ?? false);

  const capture = await payments.capture(o.paymentAuthId, Math.min(bill.total, o.authorizedAmount));
  unsubscribe?.();
  unsubscribe = null;
  if (o.pumpNumber) unpinPump(o.stationId, o.pumpNumber);

  const done: Partial<Order> = {
    fuelAmount: withFuel.fuelAmount,
    fuelCost: bill.fuelCost,
    fnbCost: bill.fnbCost,
    serviceFee: bill.serviceFee,
    discounts: bill.discounts,
    pointsToRedeem: bill.pointsRedeemed,
    voucherId: bill.voucherId,
    total: capture.amount,
    vat: bill.vat,
    paymentRef: capture.reference,
    status: 'complete',
    pointsEarned: bill.pointsEarned,
    pointsRedeemed: bill.pointsRedeemed,
    completedAt: Date.now(),
  };
  patchOrder(orderId, done);
  ordersStore.set({ activeOrderId: null });
  settleLoyalty(orderById(orderId)!, station);
  return orderById(orderId)!;
}

// ---- Café fulfilment tracking (derived from time; production: kitchen display events) ----

export type FnbStage = 'received' | 'preparing' | 'on_the_way' | 'delivered' | 'ready_counter';

export function fnbStageAt(order: Order, now: number): FnbStage | null {
  if (!order.fnbPlacedAt || order.fnbItems.length === 0) return null;
  const t = now - order.fnbPlacedAt;
  if (t < 4000) return 'received';
  if (t < 20_000) return 'preparing';
  if (order.pickupMode === 'counter') return 'ready_counter';
  return t < 30_000 ? 'on_the_way' : 'delivered';
}
