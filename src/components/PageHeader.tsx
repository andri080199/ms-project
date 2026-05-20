'use client'; // tandai sebagai Client Component karena butuh DOM access (getElementById)

import { Typography } from 'antd'; // komponen teks terstruktur AntD
import { useEffect, useState, type ReactNode } from 'react'; // hooks React + tipe ReactNode
import { createPortal } from 'react-dom'; // API React untuk merender konten di luar tree DOM saat ini

// Destruktur subkomponen Typography yang dipakai
const { Title, Text } = Typography;

// Merender children ke dalam portal target `#page-header-slot` yang ada di dalam
// layout dashboard. Ini memungkinkan setiap halaman mengontrol konten header
// tanpa harus prop-drill melalui seluruh pohon layout.
export default function PageHeader({ children }: { children: ReactNode }) {
  // State: referensi ke elemen #page-header-slot (hanya ada di browser, bukan SSR)
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  // Elemen slot hanya ada di browser, jadi kita cari setelah mount (bukan saat SSR)
  useEffect(() => {
    setSlot(document.getElementById('page-header-slot')); // cari elemen target portal
  }, []); // [] → hanya jalankan sekali saat mount

  // Jika slot belum ditemukan (SSR atau belum mount), render null
  if (!slot) return null;

  // Render children ke dalam slot yang ada di layout (di luar tree komponen ini)
  return createPortal(children, slot);
}

// Blok judul halaman standar dengan bar aksen gradien di kiri, judul utama,
// dan baris subtitle opsional di bawahnya.
export function PageTitle({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) {
  return (
    // Flex row: bar aksen + konten teks
    <div className="flex items-center gap-3 pl-1 min-w-0">
      {/* Bar aksen gradien vertikal — dekoratif, tersembunyi dari pembaca layar */}
      <span
        aria-hidden // abaikan oleh screen reader (murni dekoratif)
        className="self-stretch rounded-full shrink-0" // tinggi menyesuaikan konten, tidak menyusut
        style={{
          width: 4, // lebar bar tipis 4px
          background:
            'linear-gradient(180deg, rgb(var(--color-primary)) 0%, rgb(var(--color-primary-700)) 100%)', // gradien dari atas ke bawah
        }}
      />

      {/* Kolom konten: judul + subtitle */}
      <div className="flex flex-col leading-tight min-w-0">
        {/* Judul utama halaman (level H3) */}
        <Title
          level={3}
          style={{
            margin: 0, // hapus margin default AntD
            color: 'rgb(var(--color-text-on-canvas))', // warna teks yang sesuai dengan latar canvas
            fontWeight: 700, // tebal
            letterSpacing: '-0.01em', // sedikit rapat untuk tampilan modern
          }}
        >
          {title} {/* teks judul dari prop */}
        </Title>

        {/* Subtitle — hanya dirender jika prop subtitle diberikan */}
        {subtitle && <Text className="text-muted text-sm">{subtitle}</Text>}
      </div>
    </div>
  );
}
