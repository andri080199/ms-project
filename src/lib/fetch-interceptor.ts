'use client';

// Global fetch interceptor — install sekali waktu module di-import di client.
// Tujuan: kalau ada API call balik 401 (session invalid/expired), otomatis
// redirect ke /login. Tanpa ini, user di mobile Safari dapat toast "Unauthorized"
// doang setelah cold reopen tab — gak nyadar harus login ulang.
//
// Kenapa monkey-patch window.fetch, bukan bikin helper apiFetch?
// Karena ada 19+ file yang udah pakai fetch() langsung — patching global
// nge-cover semua tanpa migrasi besar-besaran, dan minim risiko regresi.

declare global {
  interface Window {
    __fiersaFetchInterceptorInstalled?: boolean;
  }
}

if (typeof window !== 'undefined' && !window.__fiersaFetchInterceptorInstalled) {
  window.__fiersaFetchInterceptorInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function patchedFetch(input, init) {
    const res = await originalFetch(input, init);

    if (res.status !== 401) return res;

    // Resolve URL ke pathname buat dicek apakah ini API call internal kita.
    let pathname = '';
    try {
      const rawUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input instanceof Request
              ? input.url
              : '';
      pathname = new URL(rawUrl, window.location.origin).pathname;
    } catch {
      return res; // URL aneh / non-standard → biarin saja
    }

    // Cuma intercept API internal, dan skip /api/auth/* biar NextAuth handle sendiri.
    const isInternalApi = pathname.startsWith('/api/') && !pathname.startsWith('/api/auth');
    if (!isInternalApi) return res;

    // Skip kalau udah di halaman login — gak perlu redirect ulang.
    if (window.location.pathname === '/login') return res;

    const callbackUrl = window.location.pathname + window.location.search;
    window.location.replace('/login?callbackUrl=' + encodeURIComponent(callbackUrl));

    // Tahan promise consumer supaya kode setelah await fetch() gak jalan
    // (mencegah toast "Unauthorized" sempat muncul sebelum navigasi).
    // Navigasi browser akan unmount halaman tak lama setelah ini.
    return new Promise<Response>(() => {});
  };
}

// Re-export biar import-nya gak di-tree-shake — file ini side-effect only.
export {};
