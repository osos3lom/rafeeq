import { BadgePercent, Check, Coffee, Copy, Crown, Gauge, Share2, Ticket, Truck, Users, Zap } from 'lucide-react';
import { useState } from 'react';
import type { PaymentMethod } from '../domain/types';
import { useI18n } from '../i18n/i18n';
import { useStore } from '../lib/store';
import { accountStore, defaultPaymentMethod, isPlus } from '../modules/account/accountStore';
import {
  PLUS_PRICING,
  REFERRAL_BONUS,
  REWARDS,
  type Reward,
  activeVouchers,
  loyaltyStore,
  pointsToSar,
  redeemReward,
  setSubscription,
  tierFor,
} from '../modules/loyalty/loyalty';
import { payments } from '../modules/payments/gateway';
import { PaymentConfirmSheet } from '../modules/payments/PaymentSheets';
import { Button, Card, Pill, SectionTitle, Segmented, Sheet, cx } from '../ui/kit';
import { toast } from '../ui/toast';
import { FuelGauge } from '../ui/visuals';

export function LoyaltyScreen() {
  const { s, pick, num, money, date } = useI18n();
  const account = useStore(accountStore);
  const loyalty = useStore(loyaltyStore);
  const user = account.user!;
  const tier = tierFor(user.tierPoints);
  const plus = isPlus(user);
  const vouchers = activeVouchers(loyalty);
  const method: PaymentMethod = defaultPaymentMethod(account)!;

  const [plan, setPlan] = useState<'monthly' | 'annual'>('monthly');
  const [redeeming, setRedeeming] = useState<Reward | null>(null);
  const [subscribing, setSubscribing] = useState(false);

  const perks = [
    { Icon: Zap, t: s.loyalty.perks.lane },
    { Icon: Coffee, t: s.loyalty.perks.coffee },
    { Icon: BadgePercent, t: s.loyalty.perks.liter },
    { Icon: Truck, t: s.loyalty.perks.fee },
    { Icon: Gauge, t: s.loyalty.perks.points },
  ];

  const share = async () => {
    const text = `${s.loyalty.referralBody(REFERRAL_BONUS)} ${user.referralCode}`;
    try {
      if (navigator.share) await navigator.share({ title: s.brand, text });
      else {
        await navigator.clipboard.writeText(user.referralCode);
        toast(s.loyalty.codeCopied);
      }
    } catch {
      // dismissed
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 pb-28 pt-4">
      <h1 className="text-2xl font-bold text-navy-800">{s.loyalty.title}</h1>

      {/* Balance + tier gauge */}
      <Card className="mt-4 bg-navy-800 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-navy-200">{s.loyalty.balance}</p>
            <p className="text-4xl font-bold tabular-nums">{num(user.pointsBalance)}</p>
            <p className="text-sm text-teal-200">{s.loyalty.worth(money(pointsToSar(user.pointsBalance)))}</p>
          </div>
          {plus && (
            <Pill tone="teal">
              <Crown className="size-3" aria-hidden />
              {s.loyalty.plus}
            </Pill>
          )}
        </div>
        <div className="mt-4 flex items-center gap-4 rounded-2xl bg-white/5 p-3">
          <div className="w-28 shrink-0">
            <FuelGauge value={tier.progress} size={112} tone="light" marks={['', '']} />
          </div>
          <div>
            <p className="text-xs text-navy-200">{s.loyalty.tier}</p>
            <p className="text-lg font-bold">{s.loyalty.tiers[tier.current.id]}</p>
            <p className="text-xs text-navy-200">
              {tier.next ? s.loyalty.toNext(num(tier.remaining), s.loyalty.tiers[tier.next.id]) : s.loyalty.topTier}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-navy-300">{s.loyalty.earnRule}</p>
      </Card>

      {/* Vouchers */}
      {vouchers.length > 0 && (
        <>
          <SectionTitle>{s.loyalty.vouchers}</SectionTitle>
          <div className="space-y-2">
            {vouchers.map((v) => (
              <Card key={v.id} className="flex items-center gap-3 border-2 border-dashed border-teal-200 bg-teal-50/40 shadow-none">
                <Ticket className="size-6 text-teal-600" aria-hidden />
                <span className="flex-1 font-semibold text-navy-800">{pick(v.titleAr, v.titleEn)}</span>
                <span className="text-xs text-teal-700">{s.loyalty.voucherAuto}</span>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Rafeeq+ */}
      <SectionTitle>{s.loyalty.plus}</SectionTitle>
      <Card>
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-navy-800 text-teal-300">
            <Crown className="size-6" aria-hidden />
          </span>
          <div className="flex-1">
            <p className="font-bold text-navy-800">{plus ? s.loyalty.plusActive : s.loyalty.plusPitch}</p>
            {plus && user.subscriptionRenewsAt && (
              <p className="text-xs text-navy-500">
                {user.subscriptionTier === 'plus_annual' ? s.loyalty.annual : s.loyalty.monthly} · {s.loyalty.renews(date(user.subscriptionRenewsAt))}
              </p>
            )}
          </div>
        </div>
        <ul className="mt-4 space-y-3">
          {perks.map(({ Icon, t }) => (
            <li key={t[0]} className="flex items-start gap-3">
              <span className={cx('grid size-8 shrink-0 place-items-center rounded-xl', plus ? 'bg-teal-600 text-white' : 'bg-teal-50 text-teal-700')}>
                {plus ? <Check className="size-4" aria-hidden /> : <Icon className="size-4" aria-hidden />}
              </span>
              <span>
                <span className="block text-sm font-semibold text-navy-800">{t[0]}</span>
                <span className="block text-xs text-navy-500">{t[1]}</span>
              </span>
            </li>
          ))}
        </ul>
        {plus ? (
          <Button
            block
            variant="ghost"
            size="md"
            className="mt-4"
            onClick={() => {
              setSubscription(user, 'none');
              toast(s.loyalty.cancelledPlus, 'info');
            }}
          >
            {s.loyalty.cancelPlus}
          </Button>
        ) : (
          <>
            <div className="mt-4">
              <Segmented
                label={s.loyalty.plus}
                value={plan}
                onChange={setPlan}
                options={[
                  { value: 'monthly', label: `${s.loyalty.monthly} · ${money(PLUS_PRICING.monthly)}` },
                  { value: 'annual', label: `${s.loyalty.annual} · ${money(PLUS_PRICING.annual)}` },
                ]}
              />
              {plan === 'annual' && <p className="mt-1.5 text-center text-xs font-semibold text-teal-700">{s.loyalty.save2}</p>}
            </div>
            <Button block className="mt-3" onClick={() => setSubscribing(true)}>
              {s.loyalty.subscribe(money(PLUS_PRICING[plan]))}
            </Button>
          </>
        )}
      </Card>

      {/* Rewards catalog */}
      <SectionTitle>{s.loyalty.rewards}</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {REWARDS.map((r) => {
          const affordable = user.pointsBalance >= r.cost;
          return (
            <Card key={r.id} className="flex flex-col p-3">
              <span className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-700">
                {r.kind === 'fuel_credit' ? <BadgePercent className="size-5" aria-hidden /> : <Coffee className="size-5" aria-hidden />}
              </span>
              <p className="mt-2 flex-1 text-sm font-semibold leading-snug text-navy-800">{pick(r.titleAr, r.titleEn)}</p>
              <p className="mt-1 text-xs tabular-nums text-navy-500">
                {num(r.cost)} {s.common.pts}
              </p>
              <Button size="md" variant={affordable ? 'soft' : 'ghost'} disabled={!affordable} className="mt-2" onClick={() => setRedeeming(r)}>
                {s.loyalty.redeem}
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Referral */}
      <SectionTitle>{s.loyalty.referral}</SectionTitle>
      <Card>
        <div className="flex items-start gap-3">
          <Users className="size-6 shrink-0 text-teal-600" aria-hidden />
          <div className="flex-1">
            <p className="text-sm text-navy-600">{s.loyalty.referralBody(REFERRAL_BONUS)}</p>
            <p className="mt-1 text-xs font-semibold text-teal-700">{s.loyalty.referralJoined(user.referralsJoined)}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(user.referralCode);
              } catch {
                // clipboard blocked
              }
              toast(s.loyalty.codeCopied);
            }}
            className="flex min-h-12 flex-1 items-center justify-between rounded-2xl border-2 border-dashed border-navy-200 px-4 font-bold tracking-widest text-navy-800"
            dir="ltr"
          >
            {user.referralCode}
            <Copy className="size-4 text-navy-400" aria-hidden />
          </button>
          <Button size="lg" onClick={share} aria-label={s.loyalty.shareCode}>
            <Share2 className="size-5" aria-hidden />
          </Button>
        </div>
      </Card>

      {/* Ledger */}
      <SectionTitle>{s.loyalty.history}</SectionTitle>
      <Card className="divide-y divide-navy-50 py-1">
        {loyalty.ledger.slice(0, 12).map((e) => {
          const delta = e.pointsEarned - e.pointsRedeemed;
          return (
            <div key={e.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-navy-800">{pick(e.noteAr, e.noteEn)}</p>
                <p className="text-xs text-navy-500">
                  {s.loyalty.reason[e.reason]} · {date(e.createdAt)}
                </p>
              </div>
              <span className={cx('text-sm font-bold tabular-nums', delta >= 0 ? 'text-teal-700' : 'text-navy-500')} dir="ltr">
                {delta >= 0 ? '+' : '−'}
                {num(Math.abs(delta))}
              </span>
            </div>
          );
        })}
      </Card>

      <Sheet open={!!redeeming} onClose={() => setRedeeming(null)} title={s.loyalty.redeem}>
        {redeeming && (
          <>
            <p className="text-navy-700">{s.loyalty.redeemConfirm(pick(redeeming.titleAr, redeeming.titleEn), redeeming.cost)}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => setRedeeming(null)}>
                {s.common.cancel}
              </Button>
              <Button
                onClick={() => {
                  if (redeemReward(redeeming)) toast(s.loyalty.redeemed);
                  setRedeeming(null);
                }}
              >
                {s.loyalty.redeem}
              </Button>
            </div>
          </>
        )}
      </Sheet>

      <PaymentConfirmSheet
        open={subscribing}
        method={method}
        amount={PLUS_PRICING[plan]}
        onClose={() => setSubscribing(false)}
        onConfirm={async () => {
          await payments.charge(method, PLUS_PRICING[plan], `plus_${plan}`);
          setSubscription(user, plan === 'annual' ? 'plus_annual' : 'plus_monthly');
          setSubscribing(false);
          toast(s.loyalty.subscribed);
        }}
      />
    </div>
  );
}
