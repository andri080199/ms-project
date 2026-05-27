'use client'; // tandai sebagai Client Component agar bisa pakai useState, useEffect, dll.

// ─── Import komponen UI dari Ant Design ──────────────────────────────────────
import { App, Button, Form, Input, Select } from 'antd';
// App     → context global untuk message/notification
// Button  → tombol UI
// Form    → form dengan validasi bawaan AntD
// Input   → input teks satu baris
// Select  → dropdown pilihan

import { type Dayjs } from 'dayjs'; // tipe Dayjs untuk nilai date picker
import { useRouter } from 'next/navigation'; // navigasi programatik (redirect setelah submit)
import { useEffect, useMemo, useState } from 'react'; // hooks React dasar
import { isWeekendRange } from '@/lib/utils'; // fungsi helper: cek apakah rentang tanggal mencakup hari weekend
import UploadField from '@/components/UploadField'; // komponen upload file (unggah lampiran)
import ResponsiveRangePicker from '@/components/ResponsiveRangePicker'; // Desktop: RangePicker dengan indikator partial. Mobile: dua DatePicker terpisah.
import { useT } from '@/lib/i18n/provider'; // hook fungsi terjemahan string sesuai bahasa aktif

// Tipe nilai form perjalanan dinas
type FormValues = {
  range: [Dayjs, Dayjs]; // rentang tanggal: [tanggal mulai, tanggal selesai]
  destination: string; // tujuan perjalanan
  purpose: string; // keperluan/tujuan perjalanan (min 30 karakter)
  tripType: 'WEEKDAY' | 'WEEKEND'; // jenis perjalanan: hari kerja atau akhir pekan
  attachmentUrl?: string; // URL lampiran opsional (surat tugas, dll.)
};

// Form pengajuan perjalanan dinas baru.
// Secara otomatis mengubah tripType ke WEEKEND jika rentang tanggal yang dipilih
// mengandung hari Sabtu atau Minggu, tapi user bisa override manual.
export default function BusinessTripForm() {
  const [form] = Form.useForm<FormValues>(); // instance form AntD untuk kontrol programatik
  const [loading, setLoading] = useState(false); // State: true saat form sedang di-submit ke API
  const router = useRouter(); // router Next.js untuk redirect setelah berhasil submit
  const { message } = App.useApp(); // API notifikasi global AntD
  const t = useT(); // fungsi terjemahan

  // Opsi dropdown jenis perjalanan (WEEKDAY / WEEKEND), di-memoize agar tidak re-render
  const tripTypeOptions = useMemo(
    () => [
      { value: 'WEEKDAY', label: t('tripType.WEEKDAY') }, // hari kerja
      { value: 'WEEKEND', label: t('tripType.WEEKEND') }, // akhir pekan
    ],
    [t], // re-compute hanya jika bahasa berubah
  );

  // ─── Auto-detect jenis perjalanan berdasarkan rentang tanggal ──────────────
  // Watch field 'range' agar useEffect dipicu setiap kali rentang tanggal berubah
  const range = Form.useWatch('range', form);
  useEffect(() => {
    if (!range) return; // belum ada rentang yang dipilih, skip
    const [start, end] = range; // destruktur tanggal mulai dan selesai
    if (!start || !end) return; // salah satu tanggal belum dipilih, skip

    // Tentukan tipe otomatis: WEEKEND jika rentang mencakup Sabtu/Minggu, WEEKDAY jika tidak
    const auto = isWeekendRange(start.toDate(), end.toDate()) ? 'WEEKEND' : 'WEEKDAY';

    // Hanya update field jika berbeda dari nilai saat ini (cegah render loop)
    if (form.getFieldValue('tripType') !== auto) {
      form.setFieldValue('tripType', auto);
    }
  }, [range, form]); // re-run setiap kali range atau instance form berubah

  // ─── Handler submit form ────────────────────────────────────────────────────
  // Validasi batas 30 hari di sisi klien sebelum mengirim ke API
  async function onFinish(values: FormValues) {
    const [start, end] = values.range; // ambil tanggal mulai dan selesai dari form

    // Hitung total hari: diff dalam hari (inklusif) + 1
    const days = end.startOf('day').diff(start.startOf('day'), 'day') + 1;

    // Validasi: maksimum 30 hari per pengajuan
    if (days > 30) {
      message.error(t('businessTrip.max30days')); // tampilkan error
      return; // batalkan submit
    }

    setLoading(true); // aktifkan loading state tombol submit

    try {
      // Kirim data pengajuan ke API
      const res = await fetch('/api/business-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: start.toISOString(), // konversi Dayjs ke ISO string untuk API
          endDate: end.toISOString(), // konversi Dayjs ke ISO string untuk API
          destination: values.destination, // tujuan perjalanan
          purpose: values.purpose, // keperluan perjalanan
          tripType: values.tripType, // jenis perjalanan (WEEKDAY/WEEKEND)
          attachmentUrl: values.attachmentUrl || undefined, // lampiran, atau undefined jika tidak ada
        }),
      });
      const json = await res.json(); // parse response

      // Jika HTTP status error atau API mengembalikan success: false
      if (!res.ok || !json.success) {
        message.error(json.error ?? t('common.saveFailed')); // tampilkan pesan error
        return; // batalkan redirect
      }

      message.success(t('businessTrip.successSubmitted')); // tampilkan notifikasi sukses
      router.push('/business-trip'); // redirect ke halaman daftar perjalanan dinas
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
    >
      {/* Field: rentang tanggal perjalanan */}
      <Form.Item
        label={t('businessTrip.labelDates')} // label: "Rentang Tanggal"
        name="range"
        rules={[
          { required: true, message: t('businessTrip.datesRequired') },
          // Mobile pakai dua DatePicker terpisah → user bisa cuma isi salah satu.
          // Custom validator memastikan dua-duanya ke-set.
          {
            validator: (_, v) => {
              if (!v || !v[0] || !v[1]) return Promise.reject(new Error(t('businessTrip.datesRequired')));
              return Promise.resolve();
            },
          },
        ]}
      >
        <ResponsiveRangePicker
          className="w-full"
          format="DD MMM YYYY"
          popupClassName="app-date-popup single-month-panel"
          inputReadOnly
          mobileLabels={[t('businessTrip.labelStartDate'), t('businessTrip.labelEndDate')]}
        />
      </Form.Item>

      {/* Field: tujuan perjalanan */}
      <Form.Item
        label={t('businessTrip.labelDestination')} // label: "Tujuan"
        name="destination"
        rules={[
          { required: true, message: t('businessTrip.destinationRequired') }, // wajib diisi
          { min: 2, max: 200 }, // panjang 2-200 karakter
        ]}
      >
        <Input placeholder={t('businessTrip.destinationPlaceholder')} maxLength={200} />
      </Form.Item>

      {/* Field: keperluan/tujuan perjalanan (wajib min 30 karakter) */}
      <Form.Item
        label={t('businessTrip.labelPurpose')} // label: "Keperluan"
        name="purpose"
        rules={[
          { required: true, message: t('businessTrip.purposeRequired') }, // wajib diisi
          { min: 30, message: t('businessTrip.purposeMin') }, // minimal 30 karakter
          { max: 1000 }, // maksimal 1000 karakter
        ]}
      >
        {/* TextArea untuk keperluan multi-baris dengan counter karakter */}
        <Input.TextArea rows={4} maxLength={1000} showCount placeholder={t('businessTrip.purposePlaceholder')} />
      </Form.Item>

      {/* Field: jenis perjalanan — diisi otomatis berdasarkan tanggal, bisa diubah manual */}
      <Form.Item
        label={t('businessTrip.labelTripType')} // label: "Jenis Perjalanan"
        name="tripType"
        rules={[{ required: true }]} // wajib dipilih
        initialValue="WEEKDAY" // default awal: hari kerja
      >
        <Select
          options={tripTypeOptions} // opsi: WEEKDAY / WEEKEND
          classNames={{ popup: { root: 'app-select-popup' } }} // styling popup dropdown
        />
      </Form.Item>

      {/* Field: lampiran (opsional) — misal surat tugas */}
      <Form.Item
        label={t('businessTrip.labelAttachment')} // label: "Lampiran"
        name="attachmentUrl" // nilai berupa URL file yang sudah di-upload
        tooltip={t('businessTrip.attachmentTooltip')} // tooltip info format file
      >
        {/* Komponen upload file kustom — mengunggah file dan menyimpan URL-nya */}
        <UploadField buttonLabel={t('businessTrip.uploadButton')} />
      </Form.Item>

      {/* Tombol submit form */}
      <div className="flex justify-end pt-2">
        <Button
          type="primary" // gaya primer (warna utama aplikasi)
          htmlType="submit" // tipe HTML submit agar trigger validasi AntD
          loading={loading} // tampilkan spinner saat proses submit
          style={{ boxShadow: '0 8px 18px -4px rgb(var(--color-primary-900) / 0.95), 0 2px 6px -2px rgb(var(--color-primary-700) / 0.6)' }} // bayangan kustom agar tombol menonjol
        >
          {t('businessTrip.submit')} {/* label: "Ajukan Perjalanan Dinas" */}
        </Button>
      </div>

      {/* Catatan: auto-detect weekend — di-render sebagai HTML karena mengandung tag <b> */}
      <div className="text-xs text-muted" dangerouslySetInnerHTML={{ __html: t('businessTrip.autoWeekendNote') }} />
    </Form>
  );
}
