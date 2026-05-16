'use client';

import Icon, {
  DashboardOutlined,
  ClockCircleOutlined,
  WalletOutlined,
  InboxOutlined,
  TeamOutlined,
  IdcardOutlined,
  UsergroupAddOutlined,
  UserOutlined,
  CalendarOutlined,
  LogoutOutlined,
  GlobalOutlined,
  CheckOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FormOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Dropdown, Menu } from 'antd';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { canManageUsers, canSeeApprovalsInbox } from '@/lib/permissions';
import type { Role } from '@prisma/client';
import { useI18n, useT } from '@/lib/i18n/provider';
import { LOCALES, LOCALE_LABEL } from '@/lib/i18n/dict';

const COLLAPSED_KEY = 'fiersa.sidebarCollapsed';

const PlaneSvg = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor">
    <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
  </svg>
);
const PlaneIcon = (props: ComponentProps<typeof Icon>) => <Icon component={PlaneSvg} {...props} />;

const REQUEST_KEY = 'request';
const REQUEST_CHILDREN: { key: string; tKey: string; icon: React.ReactNode }[] = [
  { key: '/overtime', tKey: 'nav.overtime', icon: <ClockCircleOutlined /> },
  { key: '/leave', tKey: 'nav.leave', icon: <CalendarOutlined /> },
  { key: '/reimbursement', tKey: 'nav.reimbursement', icon: <WalletOutlined /> },
  { key: '/business-trip', tKey: 'nav.businessTrip', icon: <PlaneIcon /> },
];
const TOP_NAV: { key: string; tKey: string; icon: React.ReactNode }[] = [
  { key: '/dashboard', tKey: 'nav.home', icon: <DashboardOutlined /> },
];
const BOTTOM_NAV: { key: string; tKey: string; icon: React.ReactNode }[] = [
  { key: '/employees', tKey: 'nav.employees', icon: <UsergroupAddOutlined /> },
  { key: '/profile', tKey: 'nav.profile', icon: <UserOutlined /> },
];
const ALL_LEAF_PATHS = [
  ...TOP_NAV.map((n) => n.key),
  ...REQUEST_CHILDREN.map((n) => n.key),
  ...BOTTOM_NAV.map((n) => n.key),
  '/approvals',
  '/admin/users',
  '/admin/positions',
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const role = session?.user?.role as Role | undefined;
  const isSuperAdmin = !!session?.user?.isSuperAdmin;
  const t = useT();
  const { locale, setLocale } = useI18n();
  const user = session?.user;
  const [collapsed, setCollapsed] = useState(false);
  const [positionName, setPositionName] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(COLLAPSED_KEY) : null;
      if (saved === '1') setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/profile', { cache: 'no-store', signal: ctrl.signal });
        const json = await res.json();
        if (json?.success) {
          setPositionName(json.data?.position?.name ?? null);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => ctrl.abort();
  }, [status]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        if (typeof window !== 'undefined') window.localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const items = useMemo(() => {
    type MenuItem = {
      key: string;
      icon: React.ReactNode;
      label: React.ReactNode;
      children?: MenuItem[];
    };
    const base: MenuItem[] = [
      ...TOP_NAV.map((n) => ({
        key: n.key,
        icon: n.icon,
        label: <Link href={n.key}>{t(n.tKey)}</Link>,
      })),
      {
        key: REQUEST_KEY,
        icon: <FormOutlined />,
        label: t('nav.request'),
        children: REQUEST_CHILDREN.map((n) => ({
          key: n.key,
          icon: n.icon,
          label: <Link href={n.key}>{t(n.tKey)}</Link>,
        })),
      },
      ...BOTTOM_NAV.map((n) => ({
        key: n.key,
        icon: n.icon,
        label: <Link href={n.key}>{t(n.tKey)}</Link>,
      })),
    ];
    if (role && canSeeApprovalsInbox({ role, isSuperAdmin })) {
      base.push({
        key: '/approvals',
        icon: <InboxOutlined />,
        label: <Link href="/approvals">{t('nav.approvals')}</Link>,
      });
    }
    if (role && canManageUsers({ role, isSuperAdmin })) {
      base.push({
        key: '/admin/users',
        icon: <TeamOutlined />,
        label: <Link href="/admin/users">{t('nav.manageUsers')}</Link>,
      });
      base.push({
        key: '/admin/positions',
        icon: <IdcardOutlined />,
        label: <Link href="/admin/positions">{t('nav.managePositions')}</Link>,
      });
    }
    return base;
  }, [role, isSuperAdmin, t]);

  const selected = ALL_LEAF_PATHS.filter((k) => pathname === k || pathname.startsWith(`${k}/`));

  const isOnRequestRoute = useMemo(
    () => REQUEST_CHILDREN.some(({ key }) => pathname === key || pathname.startsWith(`${key}/`)),
    [pathname],
  );
  const [openKeys, setOpenKeys] = useState<string[]>(isOnRequestRoute ? [REQUEST_KEY] : []);
  useEffect(() => {
    if (isOnRequestRoute) {
      setOpenKeys((prev) => (prev.includes(REQUEST_KEY) ? prev : [...prev, REQUEST_KEY]));
    }
  }, [isOnRequestRoute]);

  const subtitle = positionName ?? (user?.role ? t(`role.${user.role}`) : '');

  const langMenu = {
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
  };

  const isCollapsed = collapsed;

  return (
    <aside
      className={`glass hidden md:flex flex-col h-[calc(100vh-2rem)] m-4 mr-0 overflow-hidden transition-[width] duration-200 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="h-full flex flex-col">
        <div
          className={`border-b border-white/10 flex items-center gap-2 ${
            isCollapsed ? 'px-2 py-4 flex-col' : 'px-5 py-6 justify-between'
          }`}
        >
          {!isCollapsed ? (
            <div className="min-w-0">
              <div
                className="font-extrabold leading-none bg-gradient-to-br from-primary-300 to-primary-500 bg-clip-text text-transparent"
                style={{ fontSize: 32, letterSpacing: '0.18em' }}
              >
                {t('brand.name')}
              </div>
              <div className="text-xs text-muted leading-tight mt-2">{t('brand.tagline')}</div>
            </div>
          ) : (
            <div
              className="font-extrabold bg-gradient-to-br from-primary-300 to-primary-500 bg-clip-text text-transparent text-center"
              style={{ fontSize: 24 }}
            >
              F
            </div>
          )}
          <Button
            type="text"
            size="small"
            icon={isCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={toggleCollapsed}
            style={{ color: 'rgb(var(--color-text-primary))' }}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          />
        </div>

        <Menu
          mode="inline"
          inlineCollapsed={isCollapsed}
          selectedKeys={selected}
          openKeys={isCollapsed ? undefined : openKeys}
          onOpenChange={(keys) => setOpenKeys(keys as string[])}
          items={items}
          style={{ background: 'transparent', border: 'none', flex: 1, minHeight: 0, overflowY: 'auto' }}
        />

        <div className="border-t border-white/10 p-2 space-y-1">
          <Dropdown menu={langMenu} trigger={['click']} placement={isCollapsed ? 'topRight' : 'top'}>
            <button
              type="button"
              aria-label={t('header.languageLabel')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition ${
                isCollapsed ? 'justify-center' : ''
              }`}
            >
              <GlobalOutlined style={{ color: 'rgb(var(--color-text-primary))' }} />
              {!isCollapsed && (
                <span className="flex-1 text-left text-sm" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  {LOCALE_LABEL[locale]}
                </span>
              )}
            </button>
          </Dropdown>

          <div
            className={`w-full flex items-center gap-3 px-3 py-2 ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <Avatar size="small" style={{ backgroundColor: 'rgb(var(--color-primary))' }} icon={<UserOutlined />} />
            {!isCollapsed && (
              <div className="flex-1 text-left min-w-0">
                <div className="text-sm font-semibold leading-tight truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  {user?.name ?? '—'}
                </div>
                <div className="text-xs text-muted leading-tight truncate">{subtitle}</div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            aria-label={t('header.signOut')}
            title={isCollapsed ? t('header.signOut') : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-red-500/10 transition ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <LogoutOutlined style={{ color: '#ff7875' }} />
            {!isCollapsed && (
              <span className="flex-1 text-left text-sm font-medium" style={{ color: '#ff7875' }}>
                {t('header.signOut')}
              </span>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
