'use client';

import type { ReactNode } from 'react';

export default function ColTitle({ label }: { label: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        style={{
          display: 'inline-block',
          width: 3,
          height: 14,
          borderRadius: 2,
          background:
            'linear-gradient(180deg, rgb(var(--color-primary)) 0%, rgb(var(--color-primary-700)) 100%)',
        }}
      />
      <span>{label}</span>
    </span>
  );
}
