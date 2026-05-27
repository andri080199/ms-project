'use client'; // tandai sebagai Client Component agar bisa pakai useState, useEffect, dll.

// ─── Import komponen UI dari Ant Design ──────────────────────────────────────
import { App, Button, DatePicker, Form, Input, Select, TimePicker } from 'antd';
// App        → context global untuk message/notification
// Button     → tombol UI
// DatePicker → date picker kalender untuk memilih tanggal lembur
// Form       → form dengan validasi bawaan AntD
// Input      → input teks (dipakai untuk TextArea alasan)
// Select     → dropdown pilihan jenis lembur
// TimePicker → time picker jam:menit untuk jam mulai dan durasi lembur

import dayjs, { type Dayjs } from 'dayjs';
// dayjs      → library tanggal ringan untuk parsing/formatting/kalkulasi
// type Dayjs → tipe objek tanggal dari dayjs

import { useRouter } from 'next/navigation'; // navigasi programatik (redirect setelah submit)
import { useMemo, useState } from 'react'; // hooks React dasar
import UploadField from '@/components/UploadField'; // komponen upload lampiran
import { useT } from '@/lib/i18n/provider'; // hook fungsi terjemahan string sesuai bahasa aktif

// Tipe nilai form pengajuan lembur
type FormValues = {
  date: Dayjs; // tanggal lembur
  startTime: Dayjs; // jam mulai lembur (hanya komponen jam & menit yang dipakai)
  overtimeType: 'PREMIUM_SHIFT' | 'OVERDAYS'; // jenis lembur
  // Durasi disimpan sebagai nilai Dayjs di mana komponen jam/menit merepresentasikan durasi,
  // bukan jam dinding. Contoh: 02:30 = 2 jam 30 menit, bukan pukul 02:30.
  duration: Dayjs;
  reason: string; // alasan lembur (min 30 karakter)
  attachmentUrl?: string; // URL lampiran opsional
};

// Form pengajuan lembur baru.
// `duration` menggunakan TimePicker format HH:mm di mana nilai waktu merepresentasikan durasi,
// bukan jam dinding. Datetime mulai absolut dibangun dengan menggabungkan `date` dan `startTime`.
export default function OvertimeForm() {
  const [loading, setLoading] = useState(false); // State: true saat form sedang di-submit ke API
  const router = useRouter(); // router Next.js untuk redirect setelah berhasil submit
  const { message } = App.useApp(); // API notifikasi global AntD
  const t = useT(); // fungsi terjemahan

  // Opsi dropdown jenis lembur — di-memoize agar tidak re-render tanpa perlu
  const overtimeTypeOptions = useMemo(
    () => [
      { value: 'PREMIUM_SHIFT', label: t('overtime.typePremiumShift') }, // lembur shift premium
      { value: 'OVERDAYS', label: t('overtime.typeOverdays') }, // lembur hari libur
    ],
    [t], // re-compute hanya jika bahasa berubah
  );

  // ─── Handler submit form ────────────────────────────────────────────────────
  async function onFinish(values: FormValues) {
    // Konversi nilai TimePicker durasi ke total menit
    const totalMinutes = values.duration.hour() * 60 + values.duration.minute();

    // Validasi: durasi harus lebih dari 0 menit
    if (totalMinutes <= 0) {
      message.error(t('overtime.durationRequired')); // tampilkan error
      return; // batalkan submit
    }

    setLoading(true); // aktifkan loading state tombol submit

    try {
      // Bangun datetime mulai absolut dengan menggabungkan tanggal dan jam mulai:
      // - Ambil tanggal lembur sebagai awal hari (00:00:00)
      const date = values.date.startOf('day');
      // - Set jam dan menit dari startTime ke objek tanggal tersebut
      const startTime = date.hour(values.startTime.hour()).minute(values.startTime.minute()).second(0);

      // Kirim data pengajuan ke API
      const res = await fetch('/api/overtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: date.toISOString(), // tanggal lembur sebagai ISO string
          startTime: startTime.toISOString(), // datetime mulai absolut sebagai ISO string
          overtimeType: values.overtimeType, // jenis lembur
          durationMinutes: totalMinutes, // durasi dalam menit (integer)
          reason: values.reason, // alasan lembur
          attachmentUrl: values.attachmentUrl || undefined, // lampiran, atau undefined jika tidak ada
        }),
      });
      const json = await res.json(); // parse response

      // Jika HTTP status error atau API mengembalikan success: false
      if (!res.ok || !json.success) {
        message.error(json.error ?? t('common.saveFailed')); // tampilkan pesan error
        return; // batalkan redirect
      }

      message.success(t('overtime.successSubmitted')); // tampilkan notifikasi sukses
      router.push('/overtime'); // redirect ke halaman daftar lembur
      router.refresh(); // refresh data halaman tujuan
    } finally {
      setLoading(false); // matikan loading state (baik sukses maupun gagal)
    }
  }

  // ─── Render form ─────────────────────────────────────────────────────────
  return (
    // Form AntD dengan layout vertikal (label di atas input)
    <Form<FormValues>
      layout="vertical" // label di atas input
      onFinish={onFinish} // handler dipanggil saat validasi lulus dan submit ditekan
      className="space-y-6" // jarak vertikal antar Form.Item
      // Nilai default: tanggal hari ini, durasi 1 jam
      initialValues={{ date: dayjs(), duration: dayjs().hour(1).minute(0) }}
    >
      {/* Field: tanggal lembur */}
      <Form.Item
        label={t('overtime.labelDate')} // label: "Tanggal Lembur"
        name="date"
        rules={[
          { required: true, message: t('overtime.dateRequired') }, // wajib diisi
          {
            // Validasi custom: tanggal harus dalam rentang [-30, +14] hari dari hari ini
            validator: async (_, value: Dayjs) => {
              if (!value) return; // skip jika belum ada nilai
              // Hitung selisih hari antara tanggal yang dipilih dan hari ini
              const diff = value.startOf('day').diff(dayjs().startOf('day'), 'day');
              if (diff < -30) throw new Error(t('overtime.datePast')); // terlalu lampau (>30 hari lalu)
              if (diff > 14) throw new Error(t('overtime.dateFuture')); // terlalu jauh ke depan (>14 hari)
            },
          },
        ]}
      >
        <DatePicker
          className="w-full" // lebar penuh
          format="DD MMM YYYY" // format tampilan: "20 Mei 2026"
          classNames={{ popup: { root: 'app-date-popup' } }} // styling popup kalender
          inputReadOnly // stop virtual keyboard di mobile — picker dipilih via popup
        />
      </Form.Item>

      {/* Field: jenis lembur (PREMIUM_SHIFT / OVERDAYS) */}
      <Form.Item
        label={t('overtime.labelOvertimeType')} // label: "Jenis Lembur"
        name="overtimeType"
        rules={[{ required: true, message: t('overtime.overtimeTypeRequired') }]} // wajib dipilih
      >
        <Select
          options={overtimeTypeOptions} // opsi jenis lembur
          placeholder={t('overtime.overtimeTypePlaceholder')} // placeholder dropdown
          classNames={{ popup: { root: 'app-select-popup' } }} // styling popup dropdown
        />
      </Form.Item>

      {/* Field: jam mulai lembur */}
      <Form.Item
        label={t('overtime.labelStartTime')} // label: "Jam Mulai"
        name="startTime"
        rules={[{ required: true, message: t('overtime.startTimeRequired') }]} // wajib diisi
      >
        {/* TimePicker: pilih jam dinding tempat lembur dimulai */}
        <TimePicker className="w-full" minuteStep={1} format="HH:mm" inputReadOnly />
      </Form.Item>

      {/* Field: durasi lembur — HH:mm merepresentasikan jam dan menit durasi kerja, bukan jam dinding */}
      <Form.Item
        label={t('overtime.labelDuration')} // label: "Durasi Lembur"
        name="duration"
        tooltip={t('overtime.durationTooltip')} // tooltip penjelasan bahwa ini adalah durasi, bukan jam
        rules={[{ required: true, message: t('overtime.durationRequired') }]} // wajib diisi
      >
        {/* showNow={false}: sembunyikan tombol "Sekarang" karena tidak relevan untuk durasi */}
        <TimePicker className="w-full" minuteStep={1} format="HH:mm" showNow={false} inputReadOnly />
      </Form.Item>

      {/* Field: alasan lembur (min 30 karakter, max 1000 karakter) */}
      <Form.Item
        label={t('overtime.labelReason')} // label: "Alasan Lembur"
        name="reason"
        rules={[
          { required: true, message: t('overtime.reasonRequired') }, // wajib diisi
          { min: 30, message: t('overtime.reasonMin') }, // minimal 30 karakter
          { max: 1000, message: t('overtime.reasonMax') }, // maksimal 1000 karakter
        ]}
      >
        {/* TextArea dengan counter karakter */}
        <Input.TextArea rows={4} placeholder={t('overtime.reasonPlaceholder')} showCount maxLength={1000} />
      </Form.Item>

      {/* Field: lampiran opsional */}
      <Form.Item
        label={t('overtime.labelAttachment')} // label: "Lampiran"
        name="attachmentUrl" // nilai berupa URL file yang sudah di-upload
        tooltip={t('overtime.attachmentTooltip')} // tooltip info format file
      >
        {/* Komponen upload file kustom — mengunggah file dan menyimpan URL-nya */}
        <UploadField buttonLabel={t('overtime.uploadButton')} />
      </Form.Item>

      {/* Tombol submit form */}
      <div className="flex justify-end pt-2">
        <Button
          type="primary" // gaya primer (warna utama aplikasi)
          htmlType="submit" // tipe HTML submit agar trigger validasi AntD
          loading={loading} // tampilkan spinner saat proses submit
          style={{ boxShadow: '0 8px 18px -4px rgb(var(--color-primary-900) / 0.95), 0 2px 6px -2px rgb(var(--color-primary-700) / 0.6)' }} // bayangan kustom agar tombol menonjol
        >
          {t('overtime.submit')} {/* label: "Ajukan Lembur" */}
        </Button>
      </div>
    </Form>
  );
}
