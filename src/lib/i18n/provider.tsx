'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { dict, translate, type Locale, type TranslationDict } from './dict';

const STORAGE_KEY = 'fiersa.locale';
const DEFAULT_LOCALE: Locale = 'en';

type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, unknown>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (saved === 'id' || saved === 'en') setLocaleState(saved);
    } catch {
      // localStorage unavailable (SSR / disabled) — keep default
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, unknown>) =>
      translate(dict[locale] as TranslationDict, key, vars),
    [locale],
  );

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

export function useT() {
  return useI18n().t;
}

export function useLocale() {
  return useI18n().locale;
}

type Formatters = {
  minutesToReadable: (minutes: number) => string;
  pluralDays: (n: number) => string;
};

export function useFormatters(): Formatters {
  const { t } = useI18n();
  return useMemo<Formatters>(
    () => ({
      minutesToReadable: (minutes: number) => {
        const safe = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;
        const h = Math.floor(safe / 60);
        const m = safe % 60;
        if (h && m) return t('time.hoursMinutes', { h, m });
        if (h) return t('time.hours', { n: h });
        return t('time.minutes', { n: m });
      },
      pluralDays: (n: number) => t('leave.daysSuffix', { n }),
    }),
    [t],
  );
}
