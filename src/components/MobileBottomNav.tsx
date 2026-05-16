'use client';

import Icon, {
  CalendarOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  EllipsisOutlined,
  GlobalOutlined,
  HomeOutlined,
  IdcardOutlined,
  InboxOutlined,
  LogoutOutlined,
  PlusOutlined,
  TeamOutlined,
  UserOutlined,
  UsergroupAddOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { Popover } from 'antd';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import type { ComponentProps, ComponentType } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Role } from '@prisma/client';
import { canManageUsers, canSeeApprovalsInbox } from '@/lib/permissions';
import { useI18n, useT } from '@/lib/i18n/provider';
import { LOCALES, LOCALE_LABEL } from '@/lib/i18n/dict';

const PlaneSvg = () => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor">
    <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
  </svg>
);
const PlaneIcon = (props: ComponentProps<typeof Icon>) => <Icon component={PlaneSvg} {...props} />;

type IconType = ComponentType<{ style?: React.CSSProperties }>;

type NavItem = {
  key: 'home' | 'employees' | 'request' | 'profile' | 'more';
  tKey: string;
  href?: string;
  match: string[];
  Icon: IconType;
};

const NAV_ITEMS: NavItem[] = [
  { key: 'home', tKey: 'nav.home', href: '/dashboard', match: ['/dashboard'], Icon: HomeOutlined },
  { key: 'employees', tKey: 'nav.employeesShort', href: '/employees', match: ['/employees'], Icon: UsergroupAddOutlined },
  {
    key: 'request',
    tKey: 'nav.request',
    match: ['/overtime', '/leave', '/reimbursement', '/business-trip'],
    Icon: PlusOutlined,
  },
  { key: 'profile', tKey: 'nav.profile', href: '/profile', match: ['/profile'], Icon: UserOutlined },
  { key: 'more', tKey: 'nav.more', match: ['/approvals', '/admin'], Icon: EllipsisOutlined },
];

const REQUEST_OPTIONS: { href: string; tKey: string; Icon: IconType }[] = [
  { href: '/overtime', tKey: 'nav.overtime', Icon: ClockCircleOutlined },
  { href: '/leave', tKey: 'nav.leave', Icon: CalendarOutlined },
  { href: '/reimbursement', tKey: 'nav.reimbursement', Icon: WalletOutlined },
  { href: '/business-trip', tKey: 'nav.businessTrip', Icon: PlaneIcon },
];

type ManageOption = {
  href: string;
  tKey: string;
  Icon: IconType;
  show: (u: { role: Role; isSuperAdmin?: boolean | null }) => boolean;
};

const MANAGE_OPTIONS: ManageOption[] = [
  { href: '/approvals', tKey: 'nav.approvals', Icon: InboxOutlined, show: canSeeApprovalsInbox },
  { href: '/admin/users', tKey: 'nav.manageUsers', Icon: TeamOutlined, show: canManageUsers },
  { href: '/admin/positions', tKey: 'nav.managePositions', Icon: IdcardOutlined, show: canManageUsers },
];

const ICON_SIZE = 36;

function matchesPath(pathname: string, patterns: string[]) {
  return patterns.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

export default function MobileBottomNav() {
  const pathname = usePathname();
  const t = useT();
  const { locale, setLocale } = useI18n();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const isSuperAdmin = !!session?.user?.isSuperAdmin;
  const [requestOpen, setRequestOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const manageOptions = useMemo(
    () => (role ? MANAGE_OPTIONS.filter((opt) => opt.show({ role, isSuperAdmin })) : []),
    [role, isSuperAdmin],
  );

  const activeIdx = useMemo(
    () => NAV_ITEMS.findIndex((n) => matchesPath(pathname, n.match)),
    [pathname],
  );

  const prevIdxRef = useRef(activeIdx);
  const oldIdx = prevIdxRef.current;
  useEffect(() => {
    prevIdxRef.current = activeIdx;
  }, [activeIdx]);

  const widthPct = 100 / NAV_ITEMS.length;
  const ActiveIcon = activeIdx >= 0 ? NAV_ITEMS[activeIdx].Icon : null;
  const WAVE_MS = 750;
  const BOB_MS = 350;

  return (
    <nav
      className="md:hidden fixed left-3 right-3 z-50 rounded-xl px-1 py-0.5"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
        background: 'rgb(var(--glass-tint))',
        border: '1px solid rgb(255 255 255 / 0.12)',
        boxShadow:
          '0 12px 32px -10px rgba(0, 0, 0, 0.45), 0 0 0 1px rgb(255 255 255 / 0.04) inset',
      }}
    >
      <div className="relative flex items-stretch">
        {/* Floating active wave — compact SVG curve that stays within the bar's flat top */}
        {ActiveIcon && (
          <div
            aria-hidden
            className="absolute pointer-events-none flex justify-center"
            style={{
              width: `${widthPct}%`,
              top: -12,
              transform: `translateX(${activeIdx * 100}%)`,
              transition: 'transform 750ms cubic-bezier(0.45, 0, 0.25, 1)',
              willChange: 'transform',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: 44,
                height: 16,
              }}
            >
              <svg
                width={44}
                height={16}
                viewBox="0 0 44 16"
                style={{
                  display: 'block',
                  position: 'absolute',
                  inset: 0,
                  overflow: 'visible',
                  shapeRendering: 'geometricPrecision',
                }}
              >
                <path
                  d="M 0 9.5 C 11 9.5, 11 0, 22 0 C 33 0, 33 9.5, 44 9.5 L 44 16 L 0 16 Z"
                  fill="rgb(var(--glass-tint))"
                />
                <path
                  d="M 0 9.5 C 11 9.5, 11 0, 22 0 C 33 0, 33 9.5, 44 9.5"
                  fill="none"
                  stroke="rgb(255 255 255 / 0.12)"
                  strokeWidth="1"
                  strokeLinecap="butt"
                />
              </svg>
            </div>
          </div>
        )}

        {NAV_ITEMS.map((item, i) => {
          const active = i === activeIdx;
          const label = t(item.tKey);
          const minIdx = Math.min(oldIdx, activeIdx);
          const maxIdx = Math.max(oldIdx, activeIdx);
          const isIntermediate =
            oldIdx !== activeIdx &&
            oldIdx >= 0 &&
            activeIdx >= 0 &&
            i > minIdx &&
            i < maxIdx;
          let bobDelayMs: number | undefined;
          if (isIntermediate) {
            const distance = Math.abs(activeIdx - oldIdx);
            const peakTimeMs = (Math.abs(i - oldIdx) / distance) * WAVE_MS;
            bobDelayMs = Math.max(0, peakTimeMs - BOB_MS / 2);
          }
          const content = (
            <NavInner
              Icon={item.Icon}
              active={active}
              bobKey={isIntermediate ? `${oldIdx}-${activeIdx}` : undefined}
              bobDelayMs={bobDelayMs}
            />
          );

          if (item.key === 'request') {
            return (
              <Popover
                key={item.key}
                open={requestOpen}
                onOpenChange={setRequestOpen}
                trigger="click"
                placement="top"
                arrow={false}
                align={{ offset: [0, -10] }}
                styles={{
                  body: {
                    background: 'rgb(var(--glass-tint))',
                    padding: 6,
                    border: '1px solid rgb(255 255 255 / 0.12)',
                    borderRadius: 14,
                    boxShadow:
                      '0 12px 32px -10px rgba(0, 0, 0, 0.45), 0 0 0 1px rgb(255 255 255 / 0.04) inset',
                  },
                }}
                content={
                  <div className="min-w-[200px] flex flex-col gap-1">
                    {REQUEST_OPTIONS.map((opt) => {
                      const OI = opt.Icon;
                      const isActive =
                        pathname === opt.href || pathname.startsWith(`${opt.href}/`);
                      return (
                        <Link
                          key={opt.href}
                          href={opt.href}
                          onClick={() => setRequestOpen(false)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-md transition hover:brightness-110"
                          style={{
                            background: isActive
                              ? 'var(--gradient-brand)'
                              : 'rgb(255 255 255 / 0.06)',
                            border: '1px solid rgb(255 255 255 / 0.08)',
                            color: '#fff',
                          }}
                        >
                          <OI style={{ fontSize: 16, color: '#fff' }} />
                          <span className="text-sm font-medium">{t(opt.tKey)}</span>
                        </Link>
                      );
                    })}
                  </div>
                }
              >
                <button
                  type="button"
                  aria-label={label}
                  className="relative z-10 flex-1 outline-none"
                >
                  {content}
                </button>
              </Popover>
            );
          }

          if (item.key === 'more') {
            return (
              <Popover
                key={item.key}
                open={moreOpen}
                onOpenChange={setMoreOpen}
                trigger="click"
                placement="topRight"
                arrow={false}
                align={{ offset: [0, -10] }}
                styles={{
                  body: {
                    background: 'rgb(var(--glass-tint))',
                    padding: 6,
                    border: '1px solid rgb(255 255 255 / 0.12)',
                    borderRadius: 14,
                    boxShadow:
                      '0 12px 32px -10px rgba(0, 0, 0, 0.45), 0 0 0 1px rgb(255 255 255 / 0.04) inset',
                  },
                }}
                content={
                  <div className="min-w-[220px] flex flex-col gap-1">
                    {manageOptions.length > 0 && (
                      <>
                        <div
                          className="text-[10px] uppercase tracking-wider px-2 pt-1 pb-1.5 font-semibold"
                          style={{ color: 'rgb(255 255 255 / 0.7)', letterSpacing: '0.06em' }}
                        >
                          {t('nav.more')}
                        </div>
                        {manageOptions.map((opt) => {
                          const OI = opt.Icon;
                          const isActive =
                            pathname === opt.href || pathname.startsWith(`${opt.href}/`);
                          return (
                            <Link
                              key={opt.href}
                              href={opt.href}
                              onClick={() => setMoreOpen(false)}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-md transition text-sm hover:brightness-110"
                              style={{
                                background: isActive
                                  ? 'var(--gradient-brand)'
                                  : 'rgb(255 255 255 / 0.06)',
                                border: '1px solid rgb(255 255 255 / 0.08)',
                                color: '#fff',
                              }}
                            >
                              <OI style={{ fontSize: 14, color: '#fff' }} />
                              <span className="font-medium">{t(opt.tKey)}</span>
                            </Link>
                          );
                        })}
                        <div className="h-px bg-white/15 my-1.5" />
                      </>
                    )}
                    <div
                      className="text-[10px] uppercase tracking-wider px-2 pt-1 pb-1.5 font-semibold"
                      style={{ color: 'rgb(255 255 255 / 0.7)', letterSpacing: '0.06em' }}
                    >
                      {t('header.languageLabel')}
                    </div>
                    {LOCALES.map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => {
                          setLocale(l);
                          setMoreOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-md transition text-sm hover:brightness-110"
                        style={{
                          background:
                            l === locale ? 'var(--gradient-brand)' : 'rgb(255 255 255 / 0.06)',
                          border: '1px solid rgb(255 255 255 / 0.08)',
                          color: '#fff',
                        }}
                      >
                        <span className="inline-flex items-center gap-2">
                          <GlobalOutlined style={{ fontSize: 14, color: '#fff' }} /> {LOCALE_LABEL[l]}
                        </span>
                        {l === locale && (
                          <CheckOutlined style={{ fontSize: 11, color: '#fff' }} />
                        )}
                      </button>
                    ))}
                    <div className="h-px bg-white/15 my-1.5" />
                    <button
                      type="button"
                      onClick={() => {
                        setMoreOpen(false);
                        signOut({ callbackUrl: '/login' });
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-md transition text-sm hover:brightness-110"
                      style={{
                        background: 'rgb(255 255 255 / 0.06)',
                        border: '1px solid rgb(255 255 255 / 0.08)',
                        color: '#ff7875',
                      }}
                    >
                      <LogoutOutlined style={{ fontSize: 14 }} /> {t('header.signOut')}
                    </button>
                  </div>
                }
              >
                <button
                  type="button"
                  aria-label={label}
                  className="relative z-10 flex-1 outline-none"
                >
                  {content}
                </button>
              </Popover>
            );
          }

          return (
            <Link
              key={item.key}
              href={item.href ?? '/'}
              aria-label={label}
              className="relative z-10 flex-1"
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function NavInner({
  Icon: IconCmp,
  active,
  bobKey,
  bobDelayMs,
}: {
  Icon: IconType;
  active: boolean;
  bobKey?: string;
  bobDelayMs?: number;
}) {
  return (
    <div className="w-full flex items-center justify-center">
      <div
        className="flex items-center justify-center"
        style={{
          width: ICON_SIZE,
          height: ICON_SIZE,
          color: '#fff',
          opacity: active ? 1 : 0.6,
          transform: active ? 'translateY(-16px) scale(1.2)' : 'translateY(0) scale(1)',
          transformOrigin: 'center',
          transition:
            'transform 750ms cubic-bezier(0.45, 0, 0.25, 1), opacity 400ms ease',
          willChange: 'transform',
        }}
      >
        <span
          key={bobKey}
          className={bobKey ? 'mobile-nav-icon-bob' : undefined}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            animationDelay: bobDelayMs !== undefined ? `${bobDelayMs}ms` : undefined,
            willChange: bobKey ? 'transform' : undefined,
          }}
        >
          <IconCmp style={{ fontSize: 20, lineHeight: 1 }} />
        </span>
      </div>
    </div>
  );
}
