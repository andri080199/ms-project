'use client'; // perlu state (useState) untuk track partial selection

import { DatePicker } from 'antd';
import type { RangePickerProps } from 'antd/es/date-picker';
import type { Dayjs } from 'dayjs';
import { useCallback, useState } from 'react';

// Wrapper di atas AntD RangePicker yang nampilin indikator visual saat user
// lagi di tengah pilih range — yaitu udah klik tanggal start tapi belum klik
// end. Default AntD GAK menandai cell yang udah ke-pick sebagai "selected"
// sampai end juga ke-pick, jadi user gak tau klik pertamanya udah register
// atau belum. Kita track partial state via onCalendarChange dan render cell
// custom via cellRender supaya kelihatan jelas.
type Props = Omit<RangePickerProps, 'cellRender' | 'onCalendarChange' | 'onOpenChange'> & {
  onCalendarChange?: RangePickerProps['onCalendarChange'];
  onOpenChange?: RangePickerProps['onOpenChange'];
};

export default function RangePickerWithIndicator(props: Props) {
  const {
    classNames: classNamesProp,
    onCalendarChange: onCalendarChangeProp,
    onOpenChange: onOpenChangeProp,
    ...rest
  } = props;

  // Track tanggal yang ke-pick tapi belum lengkap (mis. start ada tapi end belum)
  const [partialStart, setPartialStart] = useState<Dayjs | null>(null);
  const [partialEnd, setPartialEnd] = useState<Dayjs | null>(null);

  const handleCalendarChange = useCallback<NonNullable<RangePickerProps['onCalendarChange']>>(
    (dates, dateStrings, info) => {
      const [s, e] = (dates ?? [null, null]) as [Dayjs | null, Dayjs | null];
      // s ada tapi e belum → user baru pilih start, lagi nunggu end
      if (s && !e) {
        setPartialStart(s);
        setPartialEnd(null);
      } else if (!s && e) {
        // jarang tapi mungkin: user ngedit end dulu sebelum start
        setPartialStart(null);
        setPartialEnd(e);
      } else {
        // lengkap atau kosong → clear partial
        setPartialStart(null);
        setPartialEnd(null);
      }
      onCalendarChangeProp?.(dates, dateStrings, info);
    },
    [onCalendarChangeProp],
  );

  // Bersihkan partial state pas popup ditutup tanpa lengkapi range
  const handleOpenChange = useCallback<NonNullable<RangePickerProps['onOpenChange']>>(
    (open) => {
      if (!open) {
        setPartialStart(null);
        setPartialEnd(null);
      }
      onOpenChangeProp?.(open);
    },
    [onOpenChangeProp],
  );

  const cellRender = useCallback(
    (current: Dayjs | number, info: { type: string; originNode: React.ReactNode }) => {
      // Cuma override untuk cell tanggal — bulan/tahun/dekade tetep default
      if (info.type !== 'date' || typeof current === 'number') return info.originNode;
      const d = current;
      const isPartialStart = !!partialStart && d.isSame(partialStart, 'day');
      const isPartialEnd = !!partialEnd && d.isSame(partialEnd, 'day');
      if (!isPartialStart && !isPartialEnd) return info.originNode;
      const cls = [
        'ant-picker-cell-inner',
        isPartialStart && 'rp-partial-start',
        isPartialEnd && 'rp-partial-end',
      ]
        .filter(Boolean)
        .join(' ');
      return <div className={cls}>{d.date()}</div>;
    },
    [partialStart, partialEnd],
  ) as RangePickerProps['cellRender'];

  // Tambahin marker class ke popup root pas ada partial selection, supaya
  // CSS bisa show banner "Pilih tanggal selesai" di atas panel
  const hasPartial = !!(partialStart || partialEnd);
  const popupRootProp = classNamesProp?.popup?.root;
  const popupRoot =
    typeof popupRootProp === 'string'
      ? `${popupRootProp}${hasPartial ? ' rp-has-partial' : ''}`
      : hasPartial
      ? 'rp-has-partial'
      : undefined;
  const mergedClassNames: RangePickerProps['classNames'] = {
    ...classNamesProp,
    popup: {
      ...classNamesProp?.popup,
      ...(popupRoot ? { root: popupRoot } : {}),
    },
  };

  return (
    <DatePicker.RangePicker
      {...rest}
      classNames={mergedClassNames}
      onCalendarChange={handleCalendarChange}
      onOpenChange={handleOpenChange}
      cellRender={cellRender}
    />
  );
}
