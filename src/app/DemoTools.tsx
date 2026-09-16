import { Crown, FastForward, Languages, MapPinned, RotateCcw, WifiOff } from 'lucide-react';
import { setLang, useI18n } from '../i18n/i18n';
import { connectivity } from '../lib/connectivity';
import { clearPersistedState, useStore } from '../lib/store';
import { accountStore, defaultVehicle, isPlus } from '../modules/account/accountStore';
import { mockStationLink } from '../modules/fueling/stationLink';
import { setSubscription } from '../modules/loyalty/loyalty';
import { orderById, ordersStore } from '../modules/orders/checkout';
import { simulateArrival } from '../modules/stations/stations';
import { Toggle, cx } from '../ui/kit';
import { router } from './router';

/** Presenter controls. Rendered beside the phone on desktop and inside Account on mobile. */
export function DemoTools({ compact }: { compact?: boolean }) {
  const { s, lang } = useI18n();
  const account = useStore(accountStore);
  const { activeOrderId } = useStore(ordersStore);
  const { simulatedOffline } = useStore(connectivity.store);
  const user = account.user;
  const active = activeOrderId ? orderById(activeOrderId) : null;

  const btn = 'flex min-h-12 w-full items-center gap-3 rounded-2xl bg-white px-4 text-start text-sm font-semibold text-navy-700 shadow-card hover:bg-navy-50 disabled:opacity-40';

  return (
    <div className={cx('space-y-2', compact && 'text-sm')}>
      <button className={btn} onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>
        <Languages className="size-5 text-teal-600" aria-hidden />
        {s.demo.language}
      </button>
      <button
        className={btn}
        disabled={!user || !!active}
        onClick={() => {
          simulateArrival(defaultVehicle(account)?.id ?? null);
          router.tab('home');
        }}
      >
        <MapPinned className="size-5 text-teal-600" aria-hidden />
        {s.demo.arrive}
      </button>
      <button className={btn} disabled={!active?.pumpSessionId} onClick={() => active?.pumpSessionId && mockStationLink.fastForward(active.pumpSessionId)}>
        <FastForward className="size-5 text-teal-600" aria-hidden />
        {s.demo.fastForward}
      </button>
      <div className={cx(btn, 'hover:bg-white')}>
        <WifiOff className="size-5 text-teal-600" aria-hidden />
        <span className="flex-1">{s.demo.offline}</span>
        <Toggle checked={simulatedOffline} onChange={connectivity.setSimulatedOffline} label={s.demo.offline} />
      </div>
      <div className={cx(btn, 'hover:bg-white', !user && 'opacity-40')}>
        <Crown className="size-5 text-teal-600" aria-hidden />
        <span className="flex-1">{s.demo.plus}</span>
        <Toggle checked={isPlus(user)} onChange={(v) => user && setSubscription(user, v ? 'plus_monthly' : 'none')} label={s.demo.plus} />
      </div>
      <button
        className={btn}
        onClick={() => {
          clearPersistedState();
          location.reload();
        }}
      >
        <RotateCcw className="size-5 text-red-700" aria-hidden />
        {s.demo.reset}
      </button>
      <p className="px-1 pt-1 text-xs text-navy-400">{s.demo.note}</p>
    </div>
  );
}
