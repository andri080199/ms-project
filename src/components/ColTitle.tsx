'use client'; // tandai sebagai Client Component (dipakai di konteks client-side table)

import type { ReactNode } from 'react'; // tipe ReactNode untuk label yang bisa berupa apapun

// Label header kolom dengan bar aksen gradien vertikal dekoratif di kirinya.
// Dipakai sebagai nilai prop `title` pada definisi kolom Ant Design Table.
export default function ColTitle({ label }: { label: ReactNode }) {
  return (
    // Flex inline: bar aksen + teks label, sejajar secara vertikal
    <span className="inline-flex items-center gap-2">
      {/* Bar gradien dekoratif — murni visual, disembunyikan dari teknologi assistif */}
      <span
        aria-hidden // abaikan oleh screen reader
        style={{
          display: 'inline-block', // agar bisa diberi ukuran (width/height)
          width: 3, // lebar bar tipis 3px
          height: 14, // tinggi bar
          borderRadius: 2, // sudut bulat
          background:
            'linear-gradient(180deg, rgb(var(--color-primary)) 0%, rgb(var(--color-primary-700)) 100%)', // gradien dari warna primer atas ke bawah
        }}
      />
      {/* Teks label kolom */}
      <span>{label}</span>
    </span>
  );
}
