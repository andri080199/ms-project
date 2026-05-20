'use client'; // tandai sebagai Client Component karena menggunakan hooks dan interaksi

// ─── Import komponen UI dari Ant Design ──────────────────────────────────────
import { Button, Typography } from 'antd';
// Button     → tombol hamburger menu
// Typography → komponen teks terstruktur (Text)

import { MenuOutlined } from '@ant-design/icons'; // ikon hamburger menu (tiga garis horizontal)
import { useI18n } from '@/lib/i18n/provider'; // hook untuk akses fungsi terjemahan

const { Text } = Typography; // destruktur subkomponen Text dari Typography

// Header top bar khusus mobile (disembunyikan di breakpoint md ke atas).
// Menampilkan nama brand dan tombol hamburger yang membuka drawer sidebar.
export default function Header({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const { t } = useI18n(); // ambil fungsi terjemahan dari context i18n

  return (
    // Header bar: glass card style, hanya tampil di mobile (md:hidden)
    <header className="glass md:hidden mx-4 mt-4 mb-2 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Tombol hamburger — membuka sidebar drawer saat diklik */}
        <Button
          type="text" // gaya teks (tidak ada border/background)
          icon={<MenuOutlined />} // ikon tiga garis
          onClick={onToggleSidebar} // panggil callback dari parent (layout)
          style={{ color: 'rgb(var(--color-text-primary))' }} // warna ikon sesuai tema
          aria-label="Open menu" // label aksesibilitas untuk screen reader
        />
        {/* Nama brand aplikasi */}
        <Text strong style={{ color: 'rgb(var(--color-text-primary))' }}>
          {t('brand.name')} {/* "FIERSA" atau nama brand sesuai terjemahan */}
        </Text>
      </div>
    </header>
  );
}
