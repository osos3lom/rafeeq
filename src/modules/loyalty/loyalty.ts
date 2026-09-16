import type { LoyaltyLedgerEntry, User, Voucher, VoucherKind } from '../../domain/types';
import { createStore, uid } from '../../lib/store';
import { accountStore, updateUser } from '../account/accountStore';

// ---- Rules -----------------------------------------------------------------

export const POINTS_PER_SAR_FUEL = 1;
export const POINTS_PER_SAR_FNB = 2;
export const PLUS_MULTIPLIER = 1.5;
export const POINTS_BLOCK = 100; // redeem in blocks of 100 points…
export const SAR_PER_BLOCK = 5; // …worth 5 SAR each
export const REFERRAL_BONUS = 250;

export const PLUS_PRICING = { monthly: 29, annual: 290 };
export const PLUS_PER_LITER_DISCOUNT = 0.05;
export const PUMP_DELIVERY_FEE = 4;

export type TierId = 'basic' | 'silver' | 'gold';
export const TIERS: { id: TierId; min: number }[] = [
  { id: 'basic', min: 0 },
  { id: 'silver', min: 2000 },
  { id: 'gold', min: 6000 },
];

export function tierFor(tierPoints: number) {
  const idx = TIERS.reduce((acc, t, i) => (tierPoints >= t.min ? i : acc), 0);
  const current = TIERS[idx];
  const next = TIERS[idx + 1] ?? null;
  const progress = next ? (tierPoints - current.min) / (next.min - current.min) : 1;
  return { current, next, progress, remaining: next ? next.min - tierPoints : 0 };
}

export const pointsToSar = (points: number) => Math.floor(points / POINTS_BLOCK) * SAR_PER_BLOCK;

export function pointsEarnedFor(fuelPaid: number, fnbPaid: number, plus: boolean) {
  const base = Math.floor(fuelPaid) * POINTS_PER_SAR_FUEL + Math.floor(fnbPaid) * POINTS_PER_SAR_FNB;
  return Math.floor(base * (plus ? PLUS_MULTIPLIER : 1));
}

export interface Reward {
  id: string;
  kind: VoucherKind;
  cost: number;
  value: number;
  titleAr: string;
  titleEn: string;
}

export const REWARDS: Reward[] = [
  { id: 'rw_coffee', kind: 'free_coffee', cost: 300, value: 0, titleAr: 'قهوة مجانية', titleEn: 'Free coffee' },
  { id: 'rw_snack', kind: 'free_snack', cost: 250, value: 0, titleAr: 'سناك أو مخبوز مجاني', titleEn: 'Free snack or pastry' },
  { id: 'rw_fuel10', kind: 'fuel_credit', cost: 450, value: 10, titleAr: 'رصيد وقود 10 ر.س', titleEn: 'SAR 10 fuel credit' },
  { id: 'rw_fuel25', kind: 'fuel_credit', cost: 1000, value: 25, titleAr: 'رصيد وقود 25 ر.س', titleEn: 'SAR 25 fuel credit' },
];

// ---- State -----------------------------------------------------------------

interface LoyaltyState {
  ledger: LoyaltyLedgerEntry[];
  vouchers: Voucher[];
}

export const loyaltyStore = createStore<LoyaltyState>({ ledger: [], vouchers: [] }, 'loyalty');

const DAY = 86_400_000;

export function seedDemoLoyalty(userId: string) {
  const now = Date.now();
  const e = (daysAgo: number, reason: LoyaltyLedgerEntry['reason'], earned: number, redeemed: number, noteAr: string, noteEn: string): LoyaltyLedgerEntry => ({
    id: uid('led'), userId, orderId: null, pointsEarned: earned, pointsRedeemed: redeemed, reason, noteAr, noteEn, createdAt: now - daysAgo * DAY,
  });
  loyaltyStore.set({
    ledger: [
      e(2, 'order', 142, 0, 'رفيق — العليا · 91 + فلات وايت', 'Rafeeq — Olaya · 91 + Flat White'),
      e(6, 'order', 96, 0, 'رفيق — حطين · 91', 'Rafeeq — Hittin · 91'),
      e(9, 'reward', 0, 300, 'قهوة مجانية', 'Free coffee'),
      e(14, 'referral', 250, 0, 'انضم صديقك فيصل', 'Your friend Faisal joined'),
      e(15, 'plus_bonus', 200, 0, 'مكافأة شهرية', 'Monthly bonus'),
    ],
    vouchers: [],
  });
}

function addLedger(entry: Omit<LoyaltyLedgerEntry, 'id' | 'createdAt' | 'userId'>) {
  const user = accountStore.get().user;
  if (!user) return;
  loyaltyStore.set((s) => ({
    ledger: [{ ...entry, id: uid('led'), userId: user.id, createdAt: Date.now() }, ...s.ledger],
  }));
}

export function creditOrder(orderId: string, earned: number, redeemed: number, noteAr: string, noteEn: string) {
  const user = accountStore.get().user;
  if (!user) return;
  addLedger({ orderId, pointsEarned: earned, pointsRedeemed: redeemed, reason: 'order', noteAr, noteEn });
  updateUser({
    pointsBalance: user.pointsBalance + earned - redeemed,
    tierPoints: user.tierPoints + earned,
  });
}

export function redeemReward(reward: Reward): boolean {
  const user = accountStore.get().user;
  if (!user || user.pointsBalance < reward.cost) return false;
  addLedger({ orderId: null, pointsEarned: 0, pointsRedeemed: reward.cost, reason: 'reward', noteAr: reward.titleAr, noteEn: reward.titleEn });
  updateUser({ pointsBalance: user.pointsBalance - reward.cost });
  loyaltyStore.set((s) => ({
    vouchers: [
      { id: uid('vch'), kind: reward.kind, value: reward.value, titleAr: reward.titleAr, titleEn: reward.titleEn, createdAt: Date.now(), usedOrderId: null },
      ...s.vouchers,
    ],
  }));
  return true;
}

export const activeVouchers = (s: LoyaltyState) => s.vouchers.filter((v) => !v.usedOrderId);

export function markVoucherUsed(voucherId: string, orderId: string) {
  loyaltyStore.set((s) => ({ vouchers: s.vouchers.map((v) => (v.id === voucherId ? { ...v, usedOrderId: orderId } : v)) }));
}

export function setSubscription(user: User, tier: User['subscriptionTier']) {
  const renews = tier === 'none' ? null : new Date(Date.now() + (tier === 'plus_annual' ? 365 : 30) * DAY).toISOString();
  updateUser({ subscriptionTier: tier, subscriptionRenewsAt: renews });
}
