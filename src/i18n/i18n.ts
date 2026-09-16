import type { Lang } from '../domain/types';
import { createStore, useStore } from '../lib/store';
import { strings } from './strings';

export const langStore = createStore<{ lang: Lang }>({ lang: 'ar' }, 'lang');

export function applyDocumentLang(lang: Lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

export function setLang(lang: Lang) {
  langStore.set({ lang });
  applyDocumentLang(lang);
}

const locale = (lang: Lang) => (lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-SA');

export function useI18n() {
  const { lang } = useStore(langStore);
  const s = strings[lang];

  const num = (n: number, digits = 0) =>
    new Intl.NumberFormat(locale(lang), {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(n);

  const money = (n: number) => (lang === 'ar' ? `${num(n, 2)} ${s.common.sar}` : `${s.common.sar} ${num(n, 2)}`);

  const date = (ts: number | string, withTime = false) =>
    new Intl.DateTimeFormat(locale(lang), {
      day: 'numeric',
      month: 'short',
      year: withTime ? undefined : 'numeric',
      ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
    }).format(new Date(ts));

  /** Pick the localized field from a bilingual record. */
  const pick = (ar: string, en: string) => (lang === 'ar' ? ar : en);

  return { lang, s, num, money, date, pick, dir: lang === 'ar' ? 'rtl' : 'ltr' };
}
