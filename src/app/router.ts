import { createStore, useStore } from '../lib/store';

export type Tab = 'home' | 'rewards' | 'profile';

export type Route =
  | { name: Tab }
  | { name: 'station'; stationId: string }
  | { name: 'fuel'; stationId: string; pump: number }
  | { name: 'session'; orderId: string }
  | { name: 'menu'; stationId: string; orderId?: string }
  | { name: 'receipt'; orderId: string; fresh?: boolean }
  | { name: 'receipts' }
  | { name: 'vehicle'; vehicleId?: string };

const store = createStore<{ stack: Route[] }>({ stack: [{ name: 'home' }] }, 'route');

const top = () => store.get().stack[store.get().stack.length - 1];

let pushedEntries = 0;
let ignoreNextPop = false;
const pop = () => store.set((s) => (s.stack.length > 1 ? { stack: s.stack.slice(0, -1) } : {}));

export const router = {
  store,
  top,
  push(route: Route) {
    store.set((s) => ({ stack: [...s.stack, route] }));
    try {
      history.pushState({ depth: store.get().stack.length }, '');
      pushedEntries++;
    } catch {
      // sandboxed iframes may block history
    }
  },
  /** Replace the current screen (e.g. payment → status, so Back doesn't return to paying). */
  replace(route: Route) {
    store.set((s) => ({ stack: [...s.stack.slice(0, -1), route] }));
  },
  back() {
    pop();
    if (pushedEntries > 0) {
      pushedEntries--;
      ignoreNextPop = true;
      history.back();
    }
  },
  tab(tab: Tab) {
    store.set({ stack: [{ name: tab }] });
  },
  /** Reset to a tab, then open a screen on top of it. */
  resetTo(tab: Tab, route?: Route) {
    store.set({ stack: route ? [{ name: tab }, route] : [{ name: tab }] });
  },
};

export function bindHistory() {
  const onPop = () => {
    if (ignoreNextPop) {
      ignoreNextPop = false;
      return;
    }
    pushedEntries = Math.max(0, pushedEntries - 1);
    pop();
  };
  window.addEventListener('popstate', onPop);
  return () => window.removeEventListener('popstate', onPop);
}

export function useRoute() {
  const { stack } = useStore(store);
  return { route: stack[stack.length - 1], depth: stack.length, root: stack[0] };
}
