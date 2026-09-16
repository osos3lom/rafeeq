import type { PaymentMethod, PaymentMethodType } from '../../domain/types';
import { round2, wait } from '../../lib/store';
import { connectivity } from '../../lib/connectivity';

// Payment layer. Pay-at-pump uses the standard fuel-dispenser pattern:
//   authorize(hold) → increment(if café items are added) → capture(final)
// so fuel + F&B settle as ONE transaction on ONE receipt.
//
// Each method has an adapter that owns the method-specific UX/token step
// (Apple Pay sheet, mada 3-D Secure, STC Pay push approval) and hands a token
// to a single `Processor` — the Saudi acquirer/PSP (e.g. HyperPay, Moyasar,
// PayTabs, Checkout.com). Only `mockProcessor` is implemented here.

export interface Authorization {
  authId: string;
  amount: number;
  method: PaymentMethodType;
}

export interface Capture {
  authId: string;
  amount: number;
  reference: string; // RRN shown on the receipt
}

export interface Processor {
  authorize(token: string, amount: number, orderRef: string): Promise<Authorization & { token: string }>;
  increment(authId: string, additional: number): Promise<{ amount: number }>;
  capture(authId: string, amount: number): Promise<Capture>;
  void(authId: string): Promise<void>;
}

export interface MethodAdapter {
  type: PaymentMethodType;
  /** Drives the confirmation UI shown before authorizing. */
  confirmation: 'biometric' | 'push_approval' | 'card';
  /** Produces a processor token (ApplePaySession / 3DS / STC Pay approval in production). */
  tokenize(method: PaymentMethod, amount: number): Promise<string>;
}

export class PaymentError extends Error {
  constructor(public code: 'offline' | 'declined' | 'limit') {
    super(code);
  }
}

// ---- Mock processor ----------------------------------------------------------

const auths = new Map<string, { amount: number; method: PaymentMethodType }>();

const assertOnline = () => {
  if (!connectivity.isOnline()) throw new PaymentError('offline');
};

export const mockProcessor: Processor = {
  async authorize(token, amount) {
    assertOnline();
    await wait(700);
    if (amount > 2500) throw new PaymentError('limit');
    const authId = `AUTH${Date.now().toString().slice(-8)}`;
    const method = token.split(':')[0] as PaymentMethodType;
    auths.set(authId, { amount, method });
    return { authId, amount: round2(amount), method, token };
  },
  async increment(authId, additional) {
    assertOnline();
    await wait(500);
    const a = auths.get(authId) ?? { amount: 0, method: 'mada' as const };
    a.amount = round2(a.amount + additional);
    auths.set(authId, a);
    return { amount: a.amount };
  },
  async capture(authId, amount) {
    await wait(600);
    auths.delete(authId);
    return { authId, amount: round2(amount), reference: `${Math.floor(1e11 + Math.random() * 9e11)}` };
  },
  async void(authId) {
    await wait(300);
    auths.delete(authId);
  },
};

// ---- Method adapters -------------------------------------------------------

const adapters: Record<PaymentMethodType, MethodAdapter> = {
  apple_pay: {
    type: 'apple_pay',
    confirmation: 'biometric',
    // Production: new ApplePaySession(3, { supportedNetworks: ['mada','visa','masterCard'], countryCode: 'SA', currencyCode: 'SAR', ... })
    async tokenize(_m, amount) {
      await wait(400);
      return `apple_pay:${amount}:${Date.now()}`;
    },
  },
  mada: {
    type: 'mada',
    confirmation: 'card',
    // Production: stored card token from the PSP vault + 3-D Secure challenge when required.
    async tokenize(m) {
      await wait(300);
      return `mada:${m.last4}:${Date.now()}`;
    },
  },
  card: {
    type: 'card',
    confirmation: 'card',
    async tokenize(m) {
      await wait(300);
      return `card:${m.last4}:${Date.now()}`;
    },
  },
  stc_pay: {
    type: 'stc_pay',
    confirmation: 'push_approval',
    // Production: STC Pay DirectPayment — request OTP/push, customer approves in the STC Pay app.
    async tokenize() {
      await wait(1200);
      return `stc_pay:${Date.now()}`;
    },
  },
};

export const adapterFor = (type: PaymentMethodType) => adapters[type];

export const payments = {
  processor: mockProcessor as Processor,

  async authorize(method: PaymentMethod, amount: number, orderRef: string): Promise<Authorization> {
    const token = await adapterFor(method.type).tokenize(method, amount);
    return this.processor.authorize(token, amount, orderRef);
  },
  increment(authId: string, additional: number) {
    return this.processor.increment(authId, additional);
  },
  capture(authId: string, amount: number) {
    return this.processor.capture(authId, amount);
  },
  void(authId: string) {
    return this.processor.void(authId);
  },
  /** One-shot charge (subscriptions, café-only orders). */
  async charge(method: PaymentMethod, amount: number, orderRef: string): Promise<Capture> {
    const auth = await this.authorize(method, amount, orderRef);
    return this.capture(auth.authId, amount);
  },
};
