'use client'; // tandai sebagai Client Component agar bisa pakai useState, useEffect, dll.

// ─── Import komponen UI dari Ant Design ──────────────────────────────────────
import { App, Button, DatePicker, Form, Input, InputNumber, Select } from 'antd';
// App         → context global untuk message/notification
// Button      → tombol UI
// DatePicker  → date picker kalender
// Form        → form dengan validasi bawaan AntD
// Input       → input teks satu baris
// InputNumber → input angka dengan formatter/parser kustom (dipakai untuk jumlah Rupiah)
// Select      → dropdown pilihan

// ─── Import ikon dari Ant Design Icons ───────────────────────────────────────
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
// DeleteOutlined → ikon tempat sampah untuk hapus item
// PlusOutlined   → ikon "+" untuk tambah item baru

import dayjs, { type Dayjs } from 'dayjs';
// dayjs      → library tanggal ringan untuk parsing/formatting
// type Dayjs → tipe objek tanggal dari dayjs (dipakai di tipe form)

import { useRouter } from 'next/navigation'; // navigasi programatik (redirect setelah submit)
import { useMemo, useState } from 'react'; // hooks React dasar
import { formatRupiah } from '@/lib/utils'; // format angka ke format mata uang Rupiah
import UploadField from '@/components/UploadField'; // komponen upload struk/bukti pembayaran
import { useT } from '@/lib/i18n/provider'; // hook fungsi terjemahan string sesuai bahasa aktif

// Tipe satu baris item reimbursement
type Item = {
  // Kategori pengeluaran — sesuai dengan enum di Prisma schema
  category: 'KANDUNGAN' | 'KACAMATA' | 'GAS_FUEL' | 'TRANSPORTATION' | 'PARKING' | 'CLIENT_ENTERTAINMENT' | 'ATK_OFFICE' | 'OFFICE_MAINTENANCE' | 'TOLL' | 'PRODUCT_DEV' | 'HOTEL_DINAS' | 'MEDICAL_BOD';
  amount: number; // jumlah reimbursement dalam Rupiah (integer)
  transactionDate: Dayjs; // tanggal transaksi sebagai objek Dayjs
  description: string; // deskripsi singkat pengeluaran (max 100 kata)
  receiptUrl?: string; // URL struk/bukti pembayaran yang sudah di-upload
};

// Daftar semua kunci kategori yang tersedia (dipakai untuk generate opsi dropdown)
const CATEGORY_KEYS: Item['category'][] = [
  'KANDUNGAN', 'KACAMATA', 'GAS_FUEL', 'TRANSPORTATION', 'PARKING',
  'CLIENT_ENTERTAINMENT', 'ATK_OFFICE', 'OFFICE_MAINTENANCE', 'TOLL',
  'PRODUCT_DEV', 'HOTEL_DINAS', 'MEDICAL_BOD',
];

// Tipe nilai keseluruhan form: berupa array item reimbursement
type FormValues = { items: Item[] };

// Form pengajuan reimbursement baru dengan satu atau lebih baris item.
// Field jumlah menggunakan handler keyboard/paste kustom untuk membatasi 10 digit
// sambil tetap menampilkan nilai dalam format Rupiah.
export default function ReimbursementForm() {
  const [loading, setLoading] = useState(false); // State: true saat form sedang di-submit ke API
  const [form] = Form.useForm<FormValues>(); // instance form AntD untuk kontrol programatik
  const router = useRouter(); // router Next.js untuk redirect setelah berhasil submit
  const { message } = App.useApp(); // API notifikasi global AntD
  const t = useT(); // fungsi terjemahan

  // Watch field 'items' untuk menghitung total nilai secara real-time saat user mengisi form
  const items = Form.useWatch('items', form) ?? []; // ambil nilai items saat ini (default: array kosong)
  // Hitung total: jumlahkan semua field 'amount' dari setiap item (fallback ke 0 jika undefined/NaN)
  const total = items.reduce((a, b) => a + (Number(b?.amount) || 0), 0);

  // Opsi dropdown kategori — di-memoize dan di-terjemahkan sesuai bahasa aktif
  const categoryOptions = useMemo(
    () => CATEGORY_KEYS.map((k) => ({ value: k, label: t(`reimbCategory.${k}`) })), // setiap key → { value, label }
    [t], // re-compute hanya jika bahasa berubah
  );

  // ─── Handler submit form ────────────────────────────────────────────────────
  async function onFinish(values: FormValues) {
    // Validasi: minimal harus ada 1 item
    if (!values.items?.length) {
      message.error(t('reimbursement.minOneItem')); // tampilkan error
      return; // batalkan submit
    }

    setLoading(true); // aktifkan loading state tombol submit

    try {
      // Kirim data pengajuan ke API
      const res = await fetch('/api/reimbursement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Petakan setiap item form ke format yang diharapkan API
          items: values.items.map((it) => ({
            category: it.category, // kode kategori pengeluaran
            amount: Number(it.amount), // pastikan berupa number (bukan string)
            transactionDate: it.transactionDate.toISOString(), // konversi Dayjs ke ISO string
            description: it.description, // deskripsi pengeluaran
            receiptUrl: it.receiptUrl || undefined, // URL struk, atau undefined jika tidak ada
          })),
        }),
      });
      const json = await res.json(); // parse response

      // Jika HTTP status error atau API mengembalikan success: false
      if (!res.ok || !json.success) {
        message.error(json.error ?? t('common.saveFailed')); // tampilkan pesan error dari API
        return; // batalkan redirect
      }

      message.success(t('reimbursement.successSubmitted')); // tampilkan notifikasi sukses
      router.push('/reimbursement'); // redirect ke halaman daftar reimbursement
      router.refresh(); // refresh data halaman tujuan
    } finally {
      setLoading(false); // matikan loading state (baik sukses maupun gagal)
    }
  }

  // ─── Render form ─────────────────────────────────────────────────────────
  return (
    // Form AntD dengan layout vertikal (label di atas input)
    <Form<FormValues>
      form={form} // bind instance form
      layout="vertical" // label di atas input
      onFinish={onFinish} // handler dipanggil saat validasi lulus dan submit ditekan
      initialValues={{
        // Satu item default dengan kategori TRANSPORTATION dan tanggal hari ini
        items: [
          { category: 'TRANSPORTATION', amount: 0, transactionDate: dayjs(), description: '', receiptUrl: undefined },
        ],
      }}
      className="space-y-6" // jarak vertikal antar elemen
    >
      {/* Form.List: array field yang bisa ditambah/dihapus secara dinamis */}
      <Form.List name="items">
        {/* fields: array deskriptor field; add/remove: fungsi untuk menambah/menghapus item */}
        {(fields, { add, remove }) => (
          <div className="space-y-4">
            {/* Render setiap item reimbursement sebagai card terpisah */}
            {fields.map((field) => (
              // field.key: key unik React untuk reconciliation
              <div key={field.key} className="glass p-4 space-y-3">
                {/* Baris atas: kategori dan tanggal transaksi (2 kolom di layar md+) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Field: kategori pengeluaran */}
                  <Form.Item
                    label={t('reimbursement.labelCategory')} // label: "Kategori"
                    name={[field.name, 'category']} // path nested: items[N].category
                    rules={[{ required: true, message: t('reimbursement.categoryRequired') }]} // wajib dipilih
                  >
                    <Select
                      options={categoryOptions} // opsi kategori yang sudah diterjemahkan
                      classNames={{ popup: { root: 'app-select-popup' } }} // styling popup
                    />
                  </Form.Item>

                  {/* Field: tanggal transaksi */}
                  <Form.Item
                    label={t('reimbursement.labelTxDate')} // label: "Tanggal Transaksi"
                    name={[field.name, 'transactionDate']} // path nested: items[N].transactionDate
                    rules={[{ required: true, message: t('reimbursement.txDateRequired') }]} // wajib diisi
                  >
                    <DatePicker
                      className="w-full" // lebar penuh
                      format="DD MMM YYYY" // format tampilan: "20 Mei 2026"
                      classNames={{ popup: { root: 'app-date-popup' } }} // styling popup kalender
                      inputReadOnly // stop virtual keyboard di mobile — tanggal dipilih via popup
                    />
                  </Form.Item>
                </div>

                {/* Field: jumlah reimbursement dalam Rupiah */}
                <Form.Item
                  label={t('reimbursement.labelAmount')} // label: "Jumlah (Rp)"
                  name={[field.name, 'amount']} // path nested: items[N].amount
                  rules={[
                    { required: true, message: t('reimbursement.amountRequired') }, // wajib diisi
                    { type: 'number', min: 1, message: t('reimbursement.amountPositive') }, // harus lebih dari 0
                    { type: 'number', max: 9999999999, message: t('reimbursement.amountMax') }, // maksimal 10 digit
                  ]}
                >
                  <InputNumber
                    className="w-full" // lebar penuh
                    min={0} // nilai minimal 0
                    max={9999999999} // nilai maksimal 9.999.999.999 (10 digit)
                    step={1000} // increment/decrement 1000 (tapi kontrol disembunyikan)
                    controls={false} // sembunyikan tombol +/- bawaan (tidak relevan untuk Rupiah)
                    inputMode="numeric" // tampilkan keyboard numerik di mobile
                    // ── Handler keyboard: blokir input non-digit dan cegah overflow 10 digit ──
                    onKeyDown={(e) => {
                      // Daftar key navigasi/kontrol yang tetap diizinkan
                      const allowed = [
                        'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight',
                        'ArrowUp', 'ArrowDown', 'Tab', 'Home', 'End',
                        'Enter', 'Escape',
                      ];
                      if (allowed.includes(e.key)) return; // izinkan key navigasi
                      if (e.ctrlKey || e.metaKey) return; // izinkan Ctrl+C, Ctrl+V, dll.
                      if (!/^\d$/.test(e.key)) {
                        e.preventDefault(); // blokir karakter non-digit (huruf, simbol, dll.)
                        return;
                      }
                      // Hitung jumlah digit yang sudah ada di input
                      const el = e.currentTarget;
                      const digitCount = el.value.replace(/\D/g, '').length;
                      const selStart = el.selectionStart ?? 0; // posisi awal seleksi
                      const selEnd = el.selectionEnd ?? 0; // posisi akhir seleksi
                      // Hitung digit yang sedang diseleksi (akan diganti, jadi tidak dihitung)
                      const selectedDigits = el.value
                        .slice(selStart, selEnd)
                        .replace(/\D/g, '').length;
                      // Blokir jika menambah digit ini akan melewati batas 10 digit
                      if (digitCount - selectedDigits >= 10) {
                        e.preventDefault();
                      }
                    }}
                    // ── Handler paste: bersihkan teks yang di-paste dan batasi 10 digit ──
                    // Menggunakan native input value setter untuk memicu synthetic event React/AntD
                    onPaste={(e) => {
                      e.preventDefault(); // cegah paste default browser
                      const pasted = e.clipboardData.getData('text').replace(/\D/g, ''); // ambil hanya digit dari teks yang di-paste
                      if (!pasted) return; // tidak ada digit yang bisa di-paste, skip

                      const el = e.currentTarget;
                      const selStart = el.selectionStart ?? 0; // posisi awal seleksi
                      const selEnd = el.selectionEnd ?? el.value.length; // posisi akhir seleksi

                      // Ambil digit sebelum dan sesudah seleksi (teks yang tidak terseleksi)
                      const beforeDigits = el.value.slice(0, selStart).replace(/\D/g, '');
                      const afterDigits = el.value.slice(selEnd).replace(/\D/g, '');

                      // Gabungkan: sebelum + paste + sesudah, lalu potong ke 10 digit
                      const combined = (beforeDigits + pasted + afterDigits).slice(0, 10);

                      // Trigger native input event agar React/AntD mendeteksi perubahan nilai
                      const setter = Object.getOwnPropertyDescriptor(
                        window.HTMLInputElement.prototype, 'value',
                      )?.set;
                      setter?.call(el, combined); // set value via native setter
                      el.dispatchEvent(new Event('input', { bubbles: true })); // trigger event React
                    }}
                    // Tampilkan nilai dengan prefix "Rp" dan pemisah ribuan titik
                    formatter={(v) => `Rp ${String(v ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`}
                    // Parse kembali ke integer bersih: hapus semua non-digit, batasi 10 digit
                    parser={((v?: string) => {
                      const digits = (v ?? '').replace(/\D/g, '').slice(0, 10); // ambil max 10 digit
                      return digits ? Number(digits) : 0; // konversi ke number, atau 0 jika kosong
                    }) as never}
                  />
                </Form.Item>

                {/* Field: deskripsi pengeluaran */}
                <Form.Item
                  label={t('reimbursement.labelDescription')} // label: "Deskripsi"
                  name={[field.name, 'description']} // path nested: items[N].description
                  rules={[
                    { required: true, message: t('reimbursement.descRequired') }, // wajib diisi
                    { min: 3, message: t('reimbursement.descMin') }, // minimal 3 karakter
                    {
                      // Validasi custom: maksimum 100 kata
                      validator: (_, v: string) => {
                        // Hitung kata dengan split whitespace dan filter empty string
                        const words = (v ?? '').trim().split(/\s+/).filter(Boolean).length;
                        return words > 100
                          ? Promise.reject(new Error(t('reimbursement.descMax'))) // terlalu banyak kata
                          : Promise.resolve(); // valid
                      },
                    },
                  ]}
                >
                  <Input placeholder={t('reimbursement.descPlaceholder')} />
                </Form.Item>

                {/* Field: struk/bukti pembayaran (wajib diupload) */}
                <Form.Item
                  label={t('reimbursement.labelReceipt')} // label: "Struk / Bukti Pembayaran"
                  name={[field.name, 'receiptUrl']} // path nested: items[N].receiptUrl
                  tooltip={t('reimbursement.receiptTooltip')} // tooltip info format file yang diterima
                  rules={[{ required: true, message: t('reimbursement.receiptRequired') }]} // wajib diupload
                >
                  {/* Komponen upload file kustom — mengunggah file dan menyimpan URL-nya */}
                  <UploadField buttonLabel={t('reimbursement.uploadReceipt')} />
                </Form.Item>

                {/* Tombol hapus item — hanya tampil jika ada lebih dari 1 item */}
                {fields.length > 1 && (
                  <Button danger icon={<DeleteOutlined />} onClick={() => remove(field.name)}>
                    {t('reimbursement.deleteItem')} {/* label: "Hapus Item Ini" */}
                  </Button>
                )}
              </div>
            ))}

            {/* Tombol tambah item baru */}
            <div className="flex justify-center pt-1">
              <Button
                type="primary" // gaya primer
                icon={<PlusOutlined />} // ikon "+"
                // Tambahkan item baru dengan nilai default
                onClick={() =>
                  add({
                    category: 'TRANSPORTATION', // default: transportasi
                    amount: 0, // default: 0
                    transactionDate: dayjs(), // default: hari ini
                    description: '', // default: kosong
                    receiptUrl: undefined, // default: belum ada struk
                  })
                }
                style={{
                  boxShadow:
                    '0 8px 18px -4px rgb(var(--color-primary-900) / 0.95), 0 2px 6px -2px rgb(var(--color-primary-700) / 0.6)', // bayangan kustom
                }}
              >
                {t('reimbursement.addItem')} {/* label: "Tambah Item" */}
              </Button>
            </div>
          </div>
        )}
      </Form.List>

      {/* Panel total: jumlah semua amount dari semua item, diperbarui real-time */}
      <div className="glass p-3 md:p-4 flex items-center justify-between">
        <span className="text-muted text-xs md:text-sm">{t('reimbursement.totalLabel')}</span> {/* label "Total:" */}
        <span className="text-sm md:text-lg font-bold">{formatRupiah(total)}</span> {/* total dalam format Rupiah */}
      </div>

      {/* Tombol submit form */}
      <div className="flex justify-end pt-2">
        <Button
          type="primary" // gaya primer
          htmlType="submit" // tipe HTML submit agar trigger validasi AntD
          loading={loading} // tampilkan spinner saat proses submit
          style={{ boxShadow: '0 8px 18px -4px rgb(var(--color-primary-900) / 0.95), 0 2px 6px -2px rgb(var(--color-primary-700) / 0.6)' }} // bayangan kustom
        >
          {t('reimbursement.submit')} {/* label: "Ajukan Reimbursement" */}
        </Button>
      </div>
    </Form>
  );
}
