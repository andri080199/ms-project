'use client'; // tandai sebagai Client Component karena butuh localStorage dan useState

// ─── Import hooks dan utilitas React ─────────────────────────────────────────
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
// createContext → membuat context untuk berbagi nilai ke seluruh pohon komponen
// useCallback   → memoize fungsi agar tidak re-created setiap render
// useContext    → membaca nilai dari context
// useEffect     → side effect (localStorage, DOM attribute)
// useMemo       → memoize nilai agar tidak recompute setiap render
// useState      → state lokal komponen
// ReactNode     → tipe untuk children React

import { dict, translate, type Locale, type TranslationDict } from './dict';
// dict         → objek kamus terjemahan untuk semua bahasa yang didukung
// translate    → fungsi murni untuk menerjemahkan key dengan variabel opsional
// Locale       → tipe union literal bahasa yang didukung: 'id' | 'en'
// TranslationDict → tipe objek kamus terjemahan per bahasa

// Key localStorage untuk menyimpan preferensi bahasa pengguna antar sesi
const STORAGE_KEY = 'fiersa.locale';

// Locale default yang ditampilkan sebelum localStorage dibaca
// (mencegah mismatch SSR — server tidak bisa baca localStorage)
const DEFAULT_LOCALE: Locale = 'en';

// Tipe nilai yang dibagikan melalui I18nContext
type I18nContextValue = {
  locale: Locale; // bahasa yang aktif saat ini
  setLocale: (l: Locale) => void; // fungsi untuk mengubah bahasa
  t: (key: string, vars?: Record<string, unknown>) => string; // fungsi terjemahan
};

// Buat context — null sebagai nilai default agar bisa dideteksi jika dipakai di luar provider
const I18nContext = createContext<I18nContextValue | null>(null);

// ─── Provider i18n tingkat aplikasi ──────────────────────────────────────────
// Membaca locale yang tersimpan dari localStorage saat mount,
// menyinkronkan atribut <html lang>, dan mengekspos t() untuk terjemahan.
export function I18nProvider({ children }: { children: ReactNode }) {
  // State: locale yang aktif (diinisialisasi dengan DEFAULT_LOCALE untuk mencegah SSR mismatch)
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Pulihkan locale yang tersimpan dari localStorage setelah hidrasi (client-side only)
  useEffect(() => {
    try {
      // Baca dari localStorage — hanya di browser (window tersedia)
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      // Hanya terima nilai 'id' atau 'en' — tolak nilai yang tidak valid
      if (saved === 'id' || saved === 'en') setLocaleState(saved);
    } catch {
      // localStorage tidak tersedia (SSR / dinonaktifkan) — tetap pakai default
    }
  }, []); // [] → hanya jalankan sekali saat mount

  // Sinkronkan atribut <html lang> setiap kali locale berubah (untuk aksesibilitas dan SEO)
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale; // ubah <html lang="en"> atau <html lang="id">
    }
  }, [locale]); // re-run setiap kali locale berubah

  // Simpan locale yang dipilih ke localStorage dan perbarui state React
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l); // perbarui state → trigger re-render dengan locale baru
    try {
      // Simpan ke localStorage agar preferensi bertahan setelah refresh
      if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // ignore — localStorage mungkin tidak tersedia di mode private/incognito
    }
  }, []); // tidak ada dependency → fungsi ini stabil (tidak berubah)

  // Fungsi terjemahan — membungkus helper translate() murni dengan locale saat ini
  const t = useCallback(
    (key: string, vars?: Record<string, unknown>) =>
      translate(dict[locale] as TranslationDict, key, vars), // cari terjemahan di kamus locale aktif
    [locale], // re-create hanya jika locale berubah
  );

  // Memoize nilai context agar child tidak re-render jika referensi object berubah tanpa perlu
  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  // Sediakan nilai context ke seluruh pohon komponen child
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// ─── Hooks untuk mengakses i18n context ──────────────────────────────────────

// Kembalikan nilai context i18n lengkap. Harus dipakai di dalam <I18nProvider>.
export function useI18n() {
  const ctx = useContext(I18nContext); // baca nilai dari context
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>'); // guard: pastikan ada provider
  return ctx;
}

// Shortcut hook yang hanya mengembalikan fungsi terjemahan t().
// Dipakai di hampir semua komponen — lebih ringkas daripada useI18n().t
export function useT() {
  return useI18n().t;
}

// Shortcut hook yang hanya mengembalikan string locale saat ini ('id' atau 'en').
// Dipakai jika komponen butuh tahu bahasa aktif (misal: untuk format tanggal locale-specific)
export function useLocale() {
  return useI18n().locale;
}

// Tipe formatter yang tersedia
type Formatters = {
  minutesToReadable: (minutes: number) => string; // konversi menit ke "X jam Y menit"
  pluralDays: (n: number) => string; // format jumlah hari: "1 hari" atau "N hari"
};

// ─── Hook formatter sadar-locale ────────────────────────────────────────────
// Mengembalikan formatter untuk durasi dan jumlah hari yang sadar bahasa.
// Nilai di-memoize dan diperbarui otomatis saat locale berubah.
export function useFormatters(): Formatters {
  const { t } = useI18n(); // ambil fungsi terjemahan dari context

  return useMemo<Formatters>(
    () => ({
      // Konversi durasi dalam menit ke string manusiawi sesuai locale
      // (misal: "2 hr 30 min" dalam bahasa Inggris, "2 jam 30 menit" dalam bahasa Indonesia)
      minutesToReadable: (minutes: number) => {
        // Pastikan input adalah bilangan positif yang valid
        const safe = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;
        const h = Math.floor(safe / 60); // hitung jam
        const m = safe % 60; // hitung sisa menit

        if (h && m) return t('time.hoursMinutes', { h, m }); // ada jam dan menit
        if (h) return t('time.hours', { n: h }); // hanya jam
        return t('time.minutes', { n: m }); // hanya menit (atau nol)
      },

      // Kembalikan string "N hari" yang terlokal untuk ringkasan pengajuan cuti
      pluralDays: (n: number) => t('leave.daysSuffix', { n }),
    }),
    [t], // re-compute hanya jika fungsi t berubah (yaitu saat locale berubah)
  );
}
