import { useSyncExternalStore } from 'react';

// Minimal external store with optional localStorage persistence. Persisting
// state is what keeps the app usable on spotty connectivity near stations and
// lets an in-progress fueling session survive an app reload.

const PREFIX = 'rafeeq:';

export interface Store<T> {
  get(): T;
  set(update: Partial<T> | ((state: T) => Partial<T>)): void;
  subscribe(listener: () => void): () => void;
  reset(): void;
}

export function createStore<T extends object>(initial: T, persistKey?: string): Store<T> {
  const key = persistKey ? `${PREFIX}${persistKey}` : null;
  let state: T = initial;

  if (key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) state = { ...initial, ...JSON.parse(raw) };
    } catch {
      // storage unavailable or corrupt — fall back to initial state
    }
  }

  const listeners = new Set<() => void>();

  const write = () => {
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // quota or private mode — the app keeps working in memory
    }
  };

  return {
    get: () => state,
    set(update) {
      const patch = typeof update === 'function' ? update(state) : update;
      state = { ...state, ...patch };
      write();
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reset() {
      state = initial;
      write();
      listeners.forEach((l) => l());
    },
  };
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function clearPersistedState() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch {
    // ignore
  }
}

export const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
