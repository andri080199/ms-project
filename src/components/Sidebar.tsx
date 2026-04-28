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
} from '@ant-design/icons';
import { Menu, Drawer } from 'antd';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { ComponentProps } from 'react';
import { useMemo } from 'react';
import { canManageUsers, canSeeApprovalsInbox } from '@/lib/permissions';
import type { Role } from '@prisma/client';
import { useT } from '@/lib/i18n/provider';

type Props = {
  open: boolean;
  onClose: () => void;
};

const PlaneSvg = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor">
    <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
  </svg>
);
const PlaneIcon = (props: ComponentProps<typeof Icon>) => <Icon component={PlaneSvg} {...props} />;

const NAV: { key: string; tKey: string; icon: React.ReactNode }[] = [
  { key: '/dashboard', tKey: 'nav.home', icon: <DashboardOutlined /> },
  { key: '/overtime', tKey: 'nav.overtime', icon: <ClockCircleOutlined /> },
  { key: '/leave', tKey: 'nav.leave', icon: <CalendarOutlined /> },
  { key: '/reimbursement', tKey: 'nav.reimbursement', icon: <WalletOutlined /> },
  { key: '/business-trip', tKey: 'nav.businessTrip', icon: <PlaneIcon /> },
  { key: '/employees', tKey: 'nav.employees', icon: <UsergroupAddOutlined /> },
  { key: '/profile', tKey: 'nav.profile', icon: <UserOutlined /> },
];

export default function Sidebar({ open, onClose }: Props) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const isSuperAdmin = !!session?.user?.isSuperAdmin;
  const t = useT();

  const items = useMemo(() => {
    const base = NAV.map((n) => ({
      key: n.key,
      icon: n.icon,
      label: <Link href={n.key}>{t(n.tKey)}</Link>,
    }));
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

  const allKeys = NAV.concat([
    { key: '/approvals', tKey: '', icon: <span /> },
    { key: '/admin/users', tKey: '', icon: <span /> },
    { key: '/admin/positions', tKey: '', icon: <span /> },
  ]);
  const selected = allKeys.map((n) => n.key).filter((k) => pathname === k || pathname.startsWith(`${k}/`));

  const inner = (
    <div className="h-full flex flex-col">
      <div className="px-5 py-6 border-b border-white/10">
        <div
          className="font-extrabold leading-none bg-gradient-to-br from-primary-300 to-primary-500 bg-clip-text text-transparent"
          style={{ fontSize: 32, letterSpacing: '0.18em' }}
        >
          {t('brand.name')}
        </div>
        <div className="text-xs text-muted leading-tight mt-2">{t('brand.tagline')}</div>
      </div>
      <Menu
        mode="inline"
        selectedKeys={selected}
        items={items}
        style={{ background: 'transparent', border: 'none', flex: 1, minHeight: 0, overflowY: 'auto' }}
        onClick={onClose}
      />
      <div className="mt-auto p-4 text-xs text-muted">
        <div>v0.1.0</div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="glass hidden md:flex flex-col w-64 h-[calc(100vh-2rem)] m-4 mr-0 sticky top-4 overflow-hidden">
        {inner}
      </aside>
      <Drawer
        open={open}
        onClose={onClose}
        placement="left"
        width={280}
        styles={{ body: { padding: 0 }, header: { display: 'none' } }}
        className="md:hidden"
      >
        {inner}
      </Drawer>
    </>
  );
}
