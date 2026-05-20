'use client'; // tandai sebagai Client Component karena butuh useState dan DOM access

// ─── Import komponen UI dari Ant Design ──────────────────────────────────────
import { Empty, Pagination, Skeleton, Table } from 'antd';
// Empty      → tampilan kosong (ikon + teks) saat tidak ada data
// Pagination → kontrol halaman untuk tampilan mobile (card list)
// Skeleton   → placeholder loading animasi saat data sedang dimuat
// Table      → tabel data dengan fitur sorting/pagination/sticky header

import type { ColumnsType } from 'antd/es/table'; // tipe definisi kolom tabel AntD
import { useEffect, useState, type Key } from 'react'; // hooks React + tipe Key
import { useT } from '@/lib/i18n/provider'; // hook fungsi terjemahan string

// Jumlah baris per halaman (berlaku untuk tabel desktop dan card list mobile)
const PAGE_SIZE = 10;

// Tipe props komponen generik RequestsTable
type Props<T> = {
  loading?: boolean; // jika true, tampilkan skeleton loader
  rows: T[]; // array data baris
  columns: ColumnsType<T>; // definisi kolom tabel AntD
  rowKey: keyof T | ((r: T) => Key); // key unik tiap baris (field atau fungsi)
  // Renderer opsional untuk tampilan card list di mobile (breakpoint md ke bawah).
  // Jika tidak diberikan, tampilan mobile tidak dirender sama sekali.
  mobileRender?: (r: T) => React.ReactNode;
  emptyText?: string; // teks yang ditampilkan saat tabel kosong (opsional)
  onRowClick?: (r: T) => void; // callback saat baris diklik (membuka modal detail)
};

// Tabel data responsif yang dipakai di semua halaman daftar pengajuan (lembur, cuti, dll.).
// Merender Ant Design Table di desktop dan card list dengan pagination manual di mobile.
export default function RequestsTable<T extends object>({
  loading, // status loading
  rows, // data baris
  columns, // definisi kolom
  rowKey, // key unik
  mobileRender, // renderer card mobile (opsional)
  emptyText, // teks kosong kustom
  onRowClick, // handler klik baris
}: Props<T>) {
  const t = useT(); // fungsi terjemahan
  const empty = emptyText ?? t('table.empty'); // gunakan teks kustom atau fallback ke default

  // State: referensi ke elemen scrollable (#page-scroll) untuk sticky header tabel
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);

  // State: halaman saat ini untuk card list mobile
  const [mobilePage, setMobilePage] = useState(1);

  // Cari elemen scrollable (#page-scroll) setelah komponen mount untuk sticky header
  useEffect(() => {
    setScrollEl(document.getElementById('page-scroll')); // elemen ini ada di layout.tsx
  }, []);

  // Saat data berkurang (misal setelah filter), reset ke halaman terakhir yang valid
  // agar tidak terjebak di halaman yang sudah tidak ada datanya
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(rows.length / PAGE_SIZE)); // halaman maksimum yang valid
    if (mobilePage > maxPage) setMobilePage(maxPage); // reset jika halaman saat ini melebihi maksimum
  }, [rows.length, mobilePage]);

  // Jika masih loading, tampilkan skeleton placeholder
  if (loading) {
    return (
      <div className="glass p-6">
        <Skeleton active paragraph={{ rows: 5 }} /> {/* 5 baris skeleton */}
      </div>
    );
  }

  // Node tampilan kosong (dipakai di tabel desktop dan card list mobile)
  const emptyNode = (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE} // ikon kosong sederhana (tidak terlalu besar)
      description={<span className="text-muted">{empty}</span>} // teks deskripsi dengan gaya muted
    />
  );

  // Potong baris untuk halaman mobile yang aktif
  const mobileRows = rows.slice((mobilePage - 1) * PAGE_SIZE, mobilePage * PAGE_SIZE);

  return (
    <>
      {/* ── Tabel Desktop — disembunyikan di bawah breakpoint md ──────────── */}
      <div className="hidden md:block glass requests-table-card">
        <Table<T>
          dataSource={rows} // data baris tabel
          columns={columns} // definisi kolom
          rowKey={rowKey as never} // key unik tiap baris
          // Tampilkan pagination hanya jika ada data; sembunyikan size changer
          pagination={rows.length > 0 ? { pageSize: PAGE_SIZE, showSizeChanger: false } : false}
          locale={{ emptyText: emptyNode }} // tampilan custom saat tabel kosong
          // Sticky header: header menempel di atas saat scroll, mengacu pada #page-scroll container
          sticky={scrollEl ? { offsetHeader: 0, getContainer: () => scrollEl } : false}
          // Klik baris: panggil onRowClick dengan data baris; tampilkan cursor pointer jika ada handler
          onRow={(r) => ({ onClick: () => onRowClick?.(r), style: { cursor: onRowClick ? 'pointer' : 'default' } })}
        />
      </div>

      {/* ── Card List Mobile — hanya dirender jika mobileRender diberikan ─── */}
      {mobileRender && (
        <div className="md:hidden space-y-3"> {/* tampil hanya di layar < md */}
          {rows.length === 0 ? (
            // Tidak ada data: tampilkan empty state di dalam glass card
            <div className="glass p-10 flex items-center justify-center">{emptyNode}</div>
          ) : (
            <>
              {/* Daftar card dengan animasi stagger (masuk berurutan) */}
              <div className="space-y-3 stagger">
                {mobileRows.map((r) => (
                  // Setiap card: key unik, efek hover glass, klik untuk buka modal detail
                  <div
                    key={typeof rowKey === 'function' ? (rowKey as (x: T) => Key)(r) : String(r[rowKey as keyof T])}
                    className="glass glass-hover p-4" // glass-hover: efek highlight saat hover
                    onClick={() => onRowClick?.(r)} // klik card = buka modal detail
                  >
                    {mobileRender(r)} {/* render konten card sesuai implementasi dari parent */}
                  </div>
                ))}
              </div>

              {/* Pagination mobile — hanya tampil jika jumlah data melebihi PAGE_SIZE */}
              {rows.length > PAGE_SIZE && (
                <div className="flex justify-center pt-2">
                  <Pagination
                    current={mobilePage} // halaman aktif saat ini
                    pageSize={PAGE_SIZE} // jumlah item per halaman
                    total={rows.length} // total item (untuk menghitung jumlah halaman)
                    onChange={setMobilePage} // update state halaman saat user klik
                    showSizeChanger={false} // sembunyikan opsi ubah ukuran halaman
                    size="small" // tampilan pagination kecil
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
