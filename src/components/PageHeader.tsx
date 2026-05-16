'use client';

import { Typography } from 'antd';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const { Title, Text } = Typography;

export default function PageHeader({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSlot(document.getElementById('page-header-slot'));
  }, []);

  if (!slot) return null;
  return createPortal(children, slot);
}

export function PageTitle({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 pl-1 min-w-0">
      <span
        aria-hidden
        className="self-stretch rounded-full shrink-0"
        style={{
          width: 4,
          background:
            'linear-gradient(180deg, rgb(var(--color-primary)) 0%, rgb(var(--color-primary-700)) 100%)',
        }}
      />
      <div className="flex flex-col leading-tight min-w-0">
        <Title
          level={3}
          style={{
            margin: 0,
            color: 'rgb(var(--color-text-on-canvas))',
            fontWeight: 700,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </Title>
        {subtitle && <Text className="text-muted text-sm">{subtitle}</Text>}
      </div>
    </div>
  );
}
