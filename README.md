# رفيق · Rafeeq

Smart gas-station companion for the Saudi market. While a Rafeeq robotic arm refuels the car, the driver pays, preorders café items to the pump, and earns loyalty points — all from the driver's seat.

Demo-ready prototype: React 19 + TypeScript + Vite + Tailwind. Arabic-first (RTL) with English, installable PWA, and offline-tolerant persisted state.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build (service worker enabled)
```

## Demo script

1. **Onboarding** → *Use demo account* → OTP `1234`. You land on a seeded Rafeeq+ account with two cars.
   A new number walks through name → add car (plate, make/model, fuel, plate-recognition opt-in).
2. **Home** → after ~6 s the simulated geofence + plate recognition "arrives" you at *Rafeeq — Olaya, pump 4*.
3. **Pay & start fueling** → amount / full tank / liters, points toggle, payment method → confirm (Apple Pay / mada / STC Pay sheet).
   Core flow is 3 taps: *Pay & start* → *Pay* → *Confirm*.
4. **Status** — steps `بانتظار السيارة → جاري التعبئة → تم` driven by pump events; tap **Browse menu** or one-tap **your usual** while fueling.
5. **Café** — add items, pick *to my car at pump N* or *counter*, **Add to bill** (same payment).
6. **Finish** → one combined receipt (fuel + café + discounts + VAT) and points credited.
7. **Rewards** — tier gauge, Rafeeq+ subscribe/cancel, redeem vouchers (auto-applied next order), referral code, points ledger.
8. **Account** — language, cars, payment methods, receipts.

Presenter controls sit beside the phone on desktop, and under *Account → Demo tools* on mobile: switch language, simulate arrival, fast-forward the pump, simulate offline, toggle Rafeeq+, reset.

## Architecture

```
src/
  domain/types.ts          data model (User, Vehicle, Station, Order, MenuItem, LoyaltyLedger…)
  data/                    sample stations (Riyadh), menus, official fuel prices
  modules/
    account/               user, vehicles, payment methods
    auth/                  OTP service interface + stub, Saudi mobile normalization
    stations/              live pump availability feed, geofence arrival, stylized map
    fueling/stationLink.ts StationLink interface · WebSocket implementation · simulated station
    payments/gateway.ts    authorize → increment → capture; per-method adapters → one Processor
    fnb/cart.ts            menu, cart, favorites, "usual" (no fueling/payment imports)
    loyalty/loyalty.ts     earn/redeem rules, tiers, Rafeeq+, rewards, ledger
    orders/                pricing.ts (pure bill engine) · checkout.ts (the only module that composes the others)
  screens/                 the 9 screens
  ui/                      kit (buttons, sheets, segmented…), fuel gauge, Saudi plate, food tiles
  i18n/                    typed ar/en strings, number/currency/date formatting
```

**Real-time fueling status.** `StationLink.subscribe(sessionId)` streams `PumpSnapshot`s (`phase: waiting | fueling | done` plus the arm stage, liters, amount). The UI only renders snapshots, so it shows the arm's real state rather than a spinner. `mockStationLink` derives snapshots from the session start time, so a reload mid-fill resumes correctly. `createSocketStationLink(baseUrl, token)` is the production shape: REST to start/stop, WebSocket for events, with reconnect and backoff.

**One transaction.** Pay-at-pump authorizes a hold for the fuel. A café order placed during fueling *increments* that authorization. Finishing *captures* the final amount (actual liters + café − discounts). The result is one charge and one receipt. Each payment method has an adapter (Apple Pay session, mada 3-D Secure, STC Pay push approval) that tokenizes and hands off to a single `Processor`. Swap `mockProcessor` for a Saudi PSP (HyperPay, Moyasar, PayTabs, Checkout.com).

**Decoupling.** `fnb` knows nothing about fueling or payments. `fueling` knows nothing about F&B. `orders/checkout.ts` composes them, and `orders/pricing.ts` is a pure function shared by the estimate, cart preview, and final settlement.

**Offline tolerance.** All stores persist to `localStorage` (account, cart, orders, last pump snapshot, last station status). The service worker (`public/sw.js`) caches the app shell and fonts. Payment actions are disabled with a clear message while offline, and the status screen shows *reconnecting* and catches up on reconnect.

## Pricing & loyalty rules (sample)

- Fuel: 91 = 2.18, 95 = 2.33, diesel = 1.66 SAR/L (VAT inclusive). Café delivery to the pump: 4 SAR.
- Points: 1/SAR on fuel, 2/SAR on café; Rafeeq+ earns ×1.5. Redeem 100 pts = 5 SAR.
- Tiers by 12-month points: Basic 0 · Silver 2,000 · Gold 6,000.
- Rafeeq+ (29 SAR/mo, 290 SAR/yr): priority lane, a free coffee with each fill-up, 5 halalas/L off, free pump delivery, ×1.5 points.
- Referral: 250 points each.

## Stubbed for the prototype

The OTP provider, payment processor, station controller/CV feed, and kitchen display events are all stubbed. The map is a stylized SVG placeholder for Mapbox or Google Maps. Station names are fictional.
