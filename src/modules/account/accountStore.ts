import type { Lang, PaymentMethod, User, Vehicle } from '../../domain/types';
import { createStore, uid } from '../../lib/store';

interface AccountState {
  user: User | null;
  vehicles: Vehicle[];
  paymentMethods: PaymentMethod[];
}

export const accountStore = createStore<AccountState>(
  { user: null, vehicles: [], paymentMethods: [] },
  'account',
);

export const DEMO_PHONE = '+966501234567';

const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

export function seedDemoAccount(lang: Lang) {
  const userId = 'usr_demo';
  accountStore.set({
    user: {
      id: userId,
      phone: DEMO_PHONE,
      name: lang === 'ar' ? 'عبدالله' : 'Abdullah',
      preferredLanguage: lang,
      subscriptionTier: 'plus_monthly',
      subscriptionRenewsAt: daysFromNow(18),
      pointsBalance: 1240,
      tierPoints: 3260,
      referralCode: 'RFQ-A7K2',
      referralsJoined: 2,
      createdAt: daysFromNow(-240),
    },
    vehicles: [
      {
        id: 'veh_camry',
        userId,
        plate: { letters: ['ر', 'س', 'ع'], digits: '1234' },
        make: 'Toyota',
        model: 'Camry',
        fuelType: '91',
        tankLiters: 60,
        recognitionLinked: true,
        isDefault: true,
      },
      {
        id: 'veh_tahoe',
        userId,
        plate: { letters: ['ب', 'ك', 'د'], digits: '782' },
        make: 'Chevrolet',
        model: 'Tahoe',
        fuelType: '95',
        tankLiters: 90,
        recognitionLinked: false,
        isDefault: false,
      },
    ],
    paymentMethods: [
      { id: 'pm_apple', type: 'apple_pay', isDefault: true },
      { id: 'pm_mada', type: 'mada', last4: '4821', network: 'mada', isDefault: false },
      { id: 'pm_stc', type: 'stc_pay', isDefault: false },
    ],
  });
}

export function createNewAccount(phone: string, name: string, lang: Lang) {
  const code = `RFQ-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  accountStore.set({
    user: {
      id: uid('usr'),
      phone,
      name,
      preferredLanguage: lang,
      subscriptionTier: 'none',
      subscriptionRenewsAt: null,
      pointsBalance: 100,
      tierPoints: 100,
      referralCode: code,
      referralsJoined: 0,
      createdAt: new Date().toISOString(),
    },
    vehicles: [],
    paymentMethods: [
      { id: 'pm_apple', type: 'apple_pay', isDefault: true },
      { id: 'pm_stc', type: 'stc_pay', isDefault: false },
    ],
  });
}

export function updateUser(patch: Partial<User>) {
  accountStore.set((s) => (s.user ? { user: { ...s.user, ...patch } } : {}));
}

export function saveVehicle(v: Omit<Vehicle, 'userId' | 'isDefault'> & { isDefault?: boolean }) {
  accountStore.set((s) => {
    const userId = s.user?.id ?? '';
    const exists = s.vehicles.some((x) => x.id === v.id);
    const isDefault = v.isDefault ?? (s.vehicles.length === 0 || s.vehicles.find((x) => x.id === v.id)?.isDefault) ?? false;
    const next: Vehicle = { ...v, userId, isDefault };
    return {
      vehicles: exists ? s.vehicles.map((x) => (x.id === v.id ? next : x)) : [...s.vehicles, next],
    };
  });
}

export function deleteVehicle(id: string) {
  accountStore.set((s) => {
    const remaining = s.vehicles.filter((v) => v.id !== id);
    if (remaining.length && !remaining.some((v) => v.isDefault)) remaining[0] = { ...remaining[0], isDefault: true };
    return { vehicles: remaining };
  });
}

export function setDefaultVehicle(id: string) {
  accountStore.set((s) => ({ vehicles: s.vehicles.map((v) => ({ ...v, isDefault: v.id === id })) }));
}

export function addPaymentMethod(pm: Omit<PaymentMethod, 'id' | 'isDefault'>) {
  accountStore.set((s) => ({ paymentMethods: [...s.paymentMethods, { ...pm, id: uid('pm'), isDefault: false }] }));
}

export function removePaymentMethod(id: string) {
  accountStore.set((s) => {
    const remaining = s.paymentMethods.filter((p) => p.id !== id);
    if (remaining.length && !remaining.some((p) => p.isDefault)) remaining[0] = { ...remaining[0], isDefault: true };
    return { paymentMethods: remaining };
  });
}

export function setDefaultPaymentMethod(id: string) {
  accountStore.set((s) => ({ paymentMethods: s.paymentMethods.map((p) => ({ ...p, isDefault: p.id === id })) }));
}

export const defaultVehicle = (s: AccountState) => s.vehicles.find((v) => v.isDefault) ?? s.vehicles[0] ?? null;
export const defaultPaymentMethod = (s: AccountState) =>
  s.paymentMethods.find((p) => p.isDefault) ?? s.paymentMethods[0] ?? null;
export const isPlus = (u: User | null) => !!u && u.subscriptionTier !== 'none';
