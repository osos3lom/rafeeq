import { Gift, House, User, WifiOff } from 'lucide-react';
import { useEffect } from 'react';
import { DemoTools } from './app/DemoTools';
import { type Tab, bindHistory, router, useRoute } from './app/router';
import { applyDocumentLang, useI18n } from './i18n/i18n';
import { useConnectivityListener, useOnline } from './lib/connectivity';
import { useStore } from './lib/store';
import { accountStore, updateUser } from './modules/account/accountStore';
import { watchActiveVisit } from './modules/orders/checkout';
import { startLiveFeed } from './modules/stations/stations';
import { FuelSelectScreen } from './screens/FuelSelectScreen';
import { FuelingStatusScreen } from './screens/FuelingStatusScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LoyaltyScreen } from './screens/LoyaltyScreen';
import { MenuScreen } from './screens/MenuScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { ProfileScreen, VehicleScreen } from './screens/ProfileScreen';
import { ReceiptScreen, ReceiptsScreen } from './screens/ReceiptScreen';
import { StationDetailScreen } from './screens/StationDetailScreen';
import { cx } from './ui/kit';
import { ToastHost } from './ui/toast';

function CurrentScreen() {
  const { route } = useRoute();
  switch (route.name) {
    case 'home':
      return <HomeScreen />;
    case 'rewards':
      return <LoyaltyScreen />;
    case 'profile':
      return <ProfileScreen />;
    case 'station':
      return <StationDetailScreen key={route.stationId} stationId={route.stationId} />;
    case 'fuel':
      return <FuelSelectScreen key={`${route.stationId}:${route.pump}`} stationId={route.stationId} pump={route.pump} />;
    case 'session':
      return <FuelingStatusScreen orderId={route.orderId} />;
    case 'menu':
      return <MenuScreen stationId={route.stationId} orderId={route.orderId} />;
    case 'receipt':
      return <ReceiptScreen key={route.orderId} orderId={route.orderId} fresh={route.fresh} />;
    case 'receipts':
      return <ReceiptsScreen />;
    case 'vehicle':
      return <VehicleScreen key={route.vehicleId ?? 'new'} vehicleId={route.vehicleId} />;
  }
}

function TabBar() {
  const { s } = useI18n();
  const { route, depth } = useRoute();
  if (depth > 1) return null;
  const tabs: { id: Tab; label: string; Icon: typeof House }[] = [
    { id: 'home', label: s.nav.home, Icon: House },
    { id: 'rewards', label: s.nav.rewards, Icon: Gift },
    { id: 'profile', label: s.nav.profile, Icon: User },
  ];
  return (
    <nav className="absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 flex rounded-3xl bg-white/95 p-1.5 shadow-lg ring-1 ring-navy-100 backdrop-blur">
      {tabs.map(({ id, label, Icon }) => {
        const active = route.name === id;
        return (
          <button
            key={id}
            onClick={() => router.tab(id)}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold transition-colors',
              active ? 'bg-teal-50 text-teal-700' : 'text-navy-400 hover:text-navy-600',
            )}
          >
            <Icon className="size-6" aria-hidden />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

export default function App() {
  const { s, lang } = useI18n();
  const { user } = useStore(accountStore);
  const online = useOnline();
  useConnectivityListener();

  useEffect(() => {
    applyDocumentLang(lang);
    if (user && user.preferredLanguage !== lang) updateUser({ preferredLanguage: lang });
  }, [lang, user]);

  useEffect(() => {
    startLiveFeed();
    watchActiveVisit(); // resume a fueling session after reload
    return bindHistory();
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[#E6EDF0] sm:flex sm:items-center sm:justify-center sm:gap-10 sm:p-6">
      {/* Phone frame on larger screens; full-bleed on phones */}
      <div className="relative mx-auto h-[100dvh] w-full overflow-hidden bg-warm-bg sm:mx-0 sm:h-[844px] sm:max-h-[calc(100dvh-48px)] sm:w-[390px] sm:rounded-[44px] sm:shadow-phone sm:ring-[10px] sm:ring-navy-950">
        {!online && (
          <div role="status" className="absolute inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900">
            <WifiOff className="size-3.5" aria-hidden />
            {s.common.offline}
          </div>
        )}
        <div className={cx('h-full', !online && 'pt-7')}>{user ? <CurrentScreen /> : <OnboardingScreen />}</div>
        {user && <TabBar />}
        <ToastHost />
      </div>

      <aside className="hidden w-72 sm:block" aria-label={s.demo.title}>
        <p className="mb-1 text-2xl font-bold text-navy-800">
          {s.brand} <span className="text-base font-medium text-navy-400">{lang === 'ar' ? 'Rafeeq' : 'رفيق'}</span>
        </p>
        <p className="mb-4 text-sm text-navy-500">{s.tagline}</p>
        <DemoTools compact />
      </aside>
    </div>
  );
}
