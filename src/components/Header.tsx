'use client';

import { Avatar, Button, Dropdown, Typography } from 'antd';
import { LogoutOutlined, UserOutlined, MenuOutlined, GlobalOutlined, CheckOutlined } from '@ant-design/icons';
import { signOut, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';
import { LOCALES, LOCALE_LABEL, LOCALE_SHORT } from '@/lib/i18n/dict';

const { Text } = Typography;

export default function Header({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const { data: session, status } = useSession();
  const { locale, setLocale, t } = useI18n();
  const user = session?.user;
  const [positionName, setPositionName] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/profile', { cache: 'no-store' });
        const json = await res.json();
        if (active && json?.success) {
          setPositionName(json.data?.position?.name ?? null);
        }
      } catch {
        /* fallback to role label */
      }
    })();
    return () => {
      active = false;
    };
  }, [status]);

  const subtitle = positionName ?? (user?.role ? t(`role.${user.role}`) : '');

  return (
    <header className="glass mx-4 mt-4 mb-2 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={onToggleSidebar}
          className="md:hidden"
          style={{ color: 'rgb(var(--color-text-primary))' }}
        />
        <div className='hidden md:block'>
          <Text strong style={{ color: 'rgb(var(--color-text-primary))' }}>
            {t('brand.name')}
          </Text>
          <div className="text-xs text-muted">{t('brand.tagline')}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Dropdown
          menu={{
            items: LOCALES.map((l) => ({
              key: l,
              label: (
                <span className="flex items-center justify-between gap-3 min-w-[160px]">
                  <span>{LOCALE_LABEL[l]}</span>
                  {l === locale ? <CheckOutlined style={{ fontSize: 12 }} /> : null}
                </span>
              ),
              onClick: () => setLocale(l),
            })),
          }}
          trigger={['click']}
        >
          <button
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-white/5 transition"
            aria-label={t('header.languageLabel')}
            type="button"
          >
            <GlobalOutlined style={{ color: 'rgb(var(--color-text-primary))' }} />
            <span className="text-xs font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
              {LOCALE_SHORT[locale]}
            </span>
          </button>
        </Dropdown>

        <Dropdown
          menu={{
            items: [
              {
                key: 'signout',
                icon: <LogoutOutlined />,
                label: t('header.signOut'),
                onClick: () => signOut({ callbackUrl: '/login' }),
              },
            ],
          }}
          trigger={['click']}
        >
          <button className="flex items-center gap-3 px-3 py-1.5 rounded-xl hover:bg-white/5 transition">
            <Avatar style={{ backgroundColor: 'rgb(var(--color-primary))' }} icon={<UserOutlined />} />
            <div className="text-left hidden sm:block">
              <div className="text-sm font-semibold leading-tight">{user?.name ?? '—'}</div>
              <div className="text-xs text-muted leading-tight">{subtitle}</div>
            </div>
          </button>
        </Dropdown>
      </div>
    </header>
  );
}
