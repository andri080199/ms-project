import dayjs from 'dayjs';

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(input: Date | string): string {
  return dayjs(input).format('DD MMM YYYY');
}

export function formatDateTime(input: Date | string): string {
  return dayjs(input).format('DD MMM YYYY, HH:mm');
}

export function formatTime(input: Date | string): string {
  return dayjs(input).format('HH:mm');
}

export function minutesToReadable(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} menit`;
  if (m === 0) return `${h} jam`;
  return `${h} jam ${m} menit`;
}

export function isWeekendRange(start: Date, end: Date): boolean {
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (cur.getTime() <= last.getTime()) {
    const day = cur.getDay();
    if (day === 0 || day === 6) return true;
    cur.setDate(cur.getDate() + 1);
  }
  return false;
}

export function ok<T>(data: T) {
  return { success: true as const, data };
}

export function fail(error: string, status = 400) {
  return { body: { success: false as const, error }, status };
}
