'use client'; // perlu interaktif (Tailwind responsive classes show/hide kedua varian)

import { DatePicker } from 'antd';
import type { RangePickerProps } from 'antd/es/date-picker';
import type { Dayjs } from 'dayjs';
import RangePickerWithIndicator from './RangePickerWithIndicator';

// Picker rentang tanggal yang switch tampilannya antar viewport:
//   - Desktop (≥768px): RangePicker dengan indikator partial (cell highlight
//     + banner "Pilih tanggal selesai" saat user baru pilih start).
//   - Mobile (<768px): dua DatePicker terpisah (start + end), karena
//     RangePicker bawaan AntD bikin 2 tap dulu baru ke-register di touch
//     device — gak user-friendly di HP.
//
// Kedua varian di-render keduanya, di-show/hide via Tailwind responsive
// class. Mereka share value & onChange yang sama dari Form.Item parent,
// jadi cukup satu source of truth.

type Value = [Dayjs | null, Dayjs | null] | null;

type Props = {
  value?: Value;
  onChange?: (val: Value, dateStrings: [string, string]) => void;
  format?: string;
  // Format khusus mobile (mis. lebih ringkas: "DD/MM"). Default ke `format`.
  mobileFormat?: string;
  placeholder?: [string, string];
  // Label di atas dua DatePicker mobile (mis. ["Tanggal Mulai", "Tanggal Selesai"]).
  // Kalau gak ke-set, label gak di-render.
  mobileLabels?: [string, string];
  // Class popup root buat varian desktop (dilewatin ke RangePickerWithIndicator)
  popupClassName?: string;
  // Class popup root buat varian mobile (untuk dua DatePicker terpisah)
  mobilePopupClassName?: string;
  className?: string;
  inputReadOnly?: boolean;
  allowClear?: boolean;
  size?: RangePickerProps['size'];
};

export default function ResponsiveRangePicker(props: Props) {
  const {
    value,
    onChange,
    format,
    mobileFormat,
    placeholder,
    mobileLabels,
    popupClassName,
    mobilePopupClassName,
    className,
    inputReadOnly,
    allowClear,
    size,
  } = props;

  const start = value?.[0] ?? null;
  const end = value?.[1] ?? null;

  const emit = (next: Value) => {
    const formatStr = format ?? 'YYYY-MM-DD';
    const startStr = next?.[0] ? next[0].format(formatStr) : '';
    const endStr = next?.[1] ? next[1].format(formatStr) : '';
    onChange?.(next, [startStr, endStr]);
  };

  const onStartChange = (v: Dayjs | null) => {
    // Kalau end udah ada dan start baru > end, reset end biar gak inkonsisten
    if (v && end && v.isAfter(end, 'day')) emit([v, null]);
    else emit([v, end]);
  };
  const onEndChange = (v: Dayjs | null) => emit([start, v]);

  const mobileDateFormat = mobileFormat ?? format;
  const mobilePopupRoot = mobilePopupClassName ?? popupClassName;

  return (
    <>
      {/* Desktop varian — RangePicker dengan indikator partial selection */}
      <div className="hidden md:block">
        <RangePickerWithIndicator
          className={className}
          value={value ?? undefined}
          onChange={(v, ds) => onChange?.(v as Value, ds)}
          format={format}
          placeholder={placeholder}
          allowClear={allowClear}
          inputReadOnly={inputReadOnly}
          size={size}
          classNames={popupClassName ? { popup: { root: popupClassName } } : undefined}
        />
      </div>

      {/* Mobile varian — dua DatePicker terpisah, 1 tap = 1 pilihan */}
      <div className="md:hidden grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          {mobileLabels?.[0] && (
            <span className="text-xs font-semibold text-muted">{mobileLabels[0]}</span>
          )}
          <DatePicker
            className={className}
            value={start}
            onChange={onStartChange}
            format={mobileDateFormat}
            placeholder={placeholder?.[0]}
            allowClear={allowClear}
            inputReadOnly={inputReadOnly}
            size={size}
            classNames={mobilePopupRoot ? { popup: { root: mobilePopupRoot } } : undefined}
          />
        </div>
        <div className="flex flex-col gap-1">
          {mobileLabels?.[1] && (
            <span className="text-xs font-semibold text-muted">{mobileLabels[1]}</span>
          )}
          <DatePicker
            className={className}
            value={end}
            onChange={onEndChange}
            format={mobileDateFormat}
            placeholder={placeholder?.[1]}
            allowClear={allowClear}
            inputReadOnly={inputReadOnly}
            size={size}
            // End harus sama atau setelah start
            disabledDate={(current) => !!start && current.isBefore(start, 'day')}
            classNames={mobilePopupRoot ? { popup: { root: mobilePopupRoot } } : undefined}
          />
        </div>
      </div>
    </>
  );
}
