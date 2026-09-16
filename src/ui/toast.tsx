import { CircleCheck, Info } from 'lucide-react';
import { createStore, useStore } from '../lib/store';

const store = createStore<{ id: number; text: string; tone: 'success' | 'info' } | { id: 0; text: ''; tone: 'info' }>({
  id: 0,
  text: '',
  tone: 'info',
});

let timer: ReturnType<typeof setTimeout> | null = null;

export function toast(text: string, tone: 'success' | 'info' = 'success') {
  if (timer) clearTimeout(timer);
  store.set({ id: Date.now(), text, tone });
  timer = setTimeout(() => store.set({ id: 0, text: '' }), 3200);
}

export function ToastHost() {
  const t = useStore(store);
  if (!t.id) return null;
  const Icon = t.tone === 'success' ? CircleCheck : Info;
  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-28 z-50 flex justify-center">
      <div
        key={t.id}
        role="status"
        className="animate-rise flex items-center gap-2.5 rounded-2xl bg-navy-800 px-4 py-3 text-sm font-medium text-white shadow-lg"
      >
        <Icon className="size-5 shrink-0 text-teal-300" aria-hidden />
        <span>{t.text}</span>
      </div>
    </div>
  );
}
