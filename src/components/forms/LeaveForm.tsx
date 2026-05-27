'use client'; // tandai sebagai Client Component agar bisa pakai useState, useEffect, dll.

// ─── Import komponen UI dari Ant Design ──────────────────────────────────────
import { App, Button, Form, Input, Select } from 'antd';
// App     → context global untuk message/notification
// Button  → tombol UI
// Form    → form dengan validasi bawaan AntD
// Input   → input teks (dipakai untuk TextArea alasan)
// Select  → dropdown pilihan jenis cuti

import { type Dayjs } from 'dayjs'; // tipe objek tanggal dari dayjs
import { useRouter } from 'next/navigation'; // navigasi programatik (redirect setelah submit)
import { useMemo, useState } from 'react'; // hooks React dasar
import UploadField from '@/components/UploadField'; // komponen upload lampiran (misal surat dokter)
import ResponsiveRangePicker from '@/components/ResponsiveRangePicker'; // Desktop: RangePicker dengan indikator partial. Mobile: dua DatePicker terpisah.
import type { LeaveType } from '@prisma/client'; // tipe enum Prisma untuk jenis cuti
import { useT } from '@/lib/i18n/provider'; // hook fungsi terjemahan string sesuai bahasa aktif

// Tipe nilai form pengajuan cuti
type FormValues = {
  dateRange: [Dayjs, Dayjs]; // rentang tanggal cuti: [tanggal mulai, tanggal selesai]
  leaveType: LeaveType; // jenis cuti (ANNUAL, SICK, PERSONAL, dll.)
  reason: string; // alasan cuti (min 5 karakter)
  attachmentUrl?: string; // URL lampiran opsional (misal: surat dokter untuk cuti sakit)
};

// Daftar semua kunci jenis cuti yang tersedia
const TYPE_KEYS: LeaveType[] = [
  'ANNUAL',
  'SICK',
  'PERSONAL',
  'MARRIAGE',
  'CHILD_MARRIAGE',
  'CHILD_CIRCUMCISION',
  'CHILD_BAPTISM',
  'FAMILY_DEATH',
  'HOUSEHOLD_DEATH',
  'MATERNITY',
  'MENSTRUAL',
  'MISCARRIAGE',
  'HAJJ',
];

// Form pengajuan cuti baru.
// Menampilkan hitungan "total hari" secara live saat user memilih rentang tanggal.
export default function LeaveForm() {
  const [loading, setLoading] = useState(false); // State: true saat form sedang di-submit ke API
  const router = useRouter(); // router Next.js untuk redirect setelah berhasil submit
  const { message } = App.useApp(); // API notifikasi global AntD
  const t = useT(); // fungsi terjemahan
  const [form] = Form.useForm<FormValues>(); // instance form AntD untuk kontrol programatik

  // ─── Hitung total hari cuti secara real-time ───────────────────────────────
  // Watch field 'dateRange' agar total hari diperbarui setiap kali rentang berubah
  const dateRange = Form.useWatch('dateRange', form);
  const days =
    dateRange?.[0] && dateRange?.[1]
      ? dateRange[1].startOf('day').diff(dateRange[0].startOf('day'), 'day') + 1 // inklusif: +1
      : null; // null jika rentang belum dipilih lengkap

  // Opsi dropdown jenis cuti — di-memoize dan diterjemahkan sesuai bahasa aktif
  const typeOptions = useMemo(
    () => TYPE_KEYS.map((v) => ({ value: v, label: t(`leaveType.${v}`) })), // setiap key → { value, label }
    [t], // re-compute hanya jika bahasa berubah
  );

  // ─── Handler submit form ────────────────────────────────────────────────────
  async function onFinish(values: FormValues) {
    const [start, end] = values.dateRange; // destruktur tanggal mulai dan selesai

    // Validasi: tanggal selesai harus sama atau setelah tanggal mulai
    if (end.isBefore(start, 'day')) {
      message.error(t('leave.endAfterStart')); // tampilkan error
      return; // batalkan submit
    }

    setLoading(true); // aktifkan loading state tombol submit

    try {
      // Kirim data pengajuan ke API
      const res = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Gunakan startOf('day') agar komponen waktu tidak menggeser tanggal melewati tengah malam
          startDate: start.startOf('day').toISOString(), // tanggal mulai sebagai ISO string (00:00:00)
          endDate: end.startOf('day').toISOString(), // tanggal selesai sebagai ISO string (00:00:00)
          leaveType: values.leaveType, // kode jenis cuti
          reason: values.reason, // alasan cuti
          attachmentUrl: values.attachmentUrl || undefined, // lampiran, atau undefined jika tidak ada
        }),
      });
      const json = await res.json(); // parse response

      // Jika HTTP status error atau API mengembalikan success: false
      if (!res.ok || !json.success) {
        message.error(json.error ?? t('common.saveFailed')); // tampilkan pesan error dari API
        return; // batalkan redirect
      }

      message.success(t('leave.successSubmitted')); // tampilkan notifikasi sukses
      router.push('/leave'); // redirect ke halaman daftar cuti
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
      className="space-y-6" // jarak vertikal antar Form.Item
      initialValues={{ leaveType: 'ANNUAL' }} // default: cuti tahunan
    >
      {/* Field: jenis cuti */}
      <Form.Item
        label={t('leave.labelType')} // label: "Jenis Cuti"
        name="leaveType"
        rules={[{ required: true, message: t('leave.typeRequired') }]} // wajib dipilih
      >
        <Select
          options={typeOptions} // opsi jenis cuti yang sudah diterjemahkan
          placeholder={t('leave.typePlaceholder')} // placeholder dropdown
          classNames={{ popup: { root: 'app-select-popup' } }} // styling popup dropdown
        />
      </Form.Item>

      {/* Field: rentang tanggal cuti — dengan tampilan total hari di bawahnya */}
      <Form.Item
        label={t('leave.labelDateRange')} // label: "Rentang Tanggal"
        name="dateRange"
        rules={[
          { required: true, message: t('leave.dateRequired') },
          // Mobile pakai dua DatePicker terpisah → user bisa cuma isi salah satu.
          // Custom validator memastikan dua-duanya ke-set.
          {
            validator: (_, v) => {
              if (!v || !v[0] || !v[1]) return Promise.reject(new Error(t('leave.dateRequired')));
              return Promise.resolve();
            },
          },
        ]}
        // Tampilkan total hari di bawah date picker (diperbarui real-time)
        extra={days != null ? <span className="text-xs text-muted">{t('leave.totalDaysLabel', { n: days })}</span> : null}
      >
        {/* Desktop: RangePicker dengan indikator partial selection.
            Mobile: dua DatePicker terpisah (1 tap = 1 pilihan). */}
        <ResponsiveRangePicker
          className="w-full" // lebar penuh
          format="DD MMM YYYY" // format tampilan: "20 Mei 2026"
          popupClassName="app-date-popup single-month-panel" // styling popup kalender
          inputReadOnly // stop virtual keyboard di mobile — tanggal dipilih via popup
          mobileLabels={[t('leave.labelStartDate'), t('leave.labelEndDate')]}
        />
      </Form.Item>

      {/* Field: alasan cuti (min 5 karakter, max 1000 karakter) */}
      <Form.Item
        label={t('leave.labelReason')} // label: "Alasan Cuti"
        name="reason"
        rules={[
          { required: true, message: t('leave.reasonRequired') }, // wajib diisi
          { min: 5, message: t('leave.reasonMin') }, // minimal 5 karakter
          { max: 1000, message: t('leave.reasonMax') }, // maksimal 1000 karakter
        ]}
      >
        {/* TextArea dengan counter karakter */}
        <Input.TextArea rows={4} placeholder={t('leave.reasonPlaceholder')} showCount maxLength={1000} />
      </Form.Item>

      {/* Field: lampiran opsional (misal: surat dokter untuk cuti sakit) */}
      <Form.Item
        label={t('leave.labelAttachment')} // label: "Lampiran"
        name="attachmentUrl" // nilai berupa URL file yang sudah di-upload
        tooltip={t('leave.attachmentTooltip')} // tooltip info format file
      >
        {/* Komponen upload file kustom — mengunggah file dan menyimpan URL-nya */}
        <UploadField buttonLabel={t('leave.uploadButton')} />
      </Form.Item>

      {/* Tombol submit form */}
      <div className="flex justify-end pt-2">
        <Button
          type="primary" // gaya primer (warna utama aplikasi)
          htmlType="submit" // tipe HTML submit agar trigger validasi AntD
          loading={loading} // tampilkan spinner saat proses submit
          style={{ boxShadow: '0 8px 18px -4px rgb(var(--color-primary-900) / 0.95), 0 2px 6px -2px rgb(var(--color-primary-700) / 0.6)' }} // bayangan kustom agar tombol menonjol
        >
          {t('leave.submit')} {/* label: "Ajukan Cuti" */}
        </Button>
      </div>
    </Form>
  );
}
