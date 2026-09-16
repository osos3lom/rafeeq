import { useEffect } from 'react';
import { createStore, useStore } from './store';

// Tracks real browser connectivity plus a demo "simulate offline" switch.
const store = createStore({ browserOnline: typeof navigator === 'undefined' ? true : navigator.onLine, simulatedOffline: false });

export const connectivity = {
  store,
  isOnline: () => store.get().browserOnline && !store.get().simulatedOffline,
  setSimulatedOffline: (v: boolean) => store.set({ simulatedOffline: v }),
};

export function useConnectivityListener() {
  useEffect(() => {
    const on = () => store.set({ browserOnline: true });
    const off = () => store.set({ browserOnline: false });
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
}

export function useOnline() {
  const s = useStore(store);
  return s.browserOnline && !s.simulatedOffline;
}
