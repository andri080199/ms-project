'use client';

// Login page. Uses NextAuth credentials provider with redirect:false so errors
// can be shown inline rather than on a separate error page.
// Wrapped in Suspense because LoginInner calls useSearchParams (which suspends during SSR).

import { Button, Form, Input, Skeleton, Typography, App, Dropdown } from 'antd';
import { signIn } from 'next-auth/react';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckOutlined, EyeInvisibleOutlined, EyeOutlined, GlobalOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useI18n } from '@/lib/i18n/provider';
import { LOCALES, LOCALE_LABEL, LOCALE_SHORT } from '@/lib/i18n/dict';

const { Text } = Typography;

type LoginForm = { email: string; password: string };

function LoginSkeleton() {
  return (
    <div className="relative z-10 min-h-screen flex items-center justify-center p-2 md:p-6">
      <div className="glass login-card w-full max-w-lg p-4 md:p-8 space-y-6">
        <div className="space-y-2 text-center flex flex-col items-center">
          <Skeleton.Input active size="large" style={{ width: 180, height: 40 }} />
          <Skeleton.Input active size="small" style={{ width: 220, height: 16 }} />
        </div>
        <div className="space-y-4">
          <Skeleton.Input active block size="large" />
          <Skeleton.Input active block size="large" />
          <div className="flex justify-center pt-1">
            <Skeleton.Button active size="large" style={{ width: 160 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const callbackUrl = search.get('callbackUrl') ?? '/dashboard';
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { message } = App.useApp();
  const { locale, setLocale, t } = useI18n();

  async function onFinish(values: LoginForm) {
    setLoading(true);
    try {
      const res = await signIn('credentials', {
        email: values.email,
        password: values.password,
        redirect: false,
      });
      if (!res || res.error) {
        message.error(t('login.errorInvalid'));
        return;
      }
      message.success(t('login.successRedirect'));
      router.push(callbackUrl);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative z-10 min-h-screen flex items-center justify-center p-2 md:p-6">
      <div className="absolute top-4 right-4 z-20">
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
            className="glass flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white/5 transition"
            aria-label={t('header.languageLabel')}
            type="button"
          >
            <GlobalOutlined style={{ color: 'rgb(var(--color-text-primary))' }} />
            <span className="text-xs font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
              {LOCALE_SHORT[locale]}
            </span>
          </button>
        </Dropdown>
      </div>

      <div className="glass login-card page-enter w-full max-w-lg p-4 md:p-8 space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="login-brand">{t('brand.name')}</h1>
          <div className="pt-1">
            <Text className="text-muted text-xs">{t('login.hint')}</Text>
          </div>
        </div>

        <Form<LoginForm> layout="vertical" onFinish={onFinish} autoComplete="off">
          <Form.Item
            label={t('login.emailLabel')}
            name="email"
            rules={[
              { required: true, message: t('login.emailRequired') },
              { type: 'email', message: t('login.emailInvalid') },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder={t('login.emailPlaceholder')} size="large" maxLength={150} />
          </Form.Item>
          <Form.Item
            label={t('login.passwordLabel')}
            name="password"
            rules={[{ required: true, message: t('login.passwordRequired') }]}
            className="!mb-2"
          >
            <Input
              type={showPassword ? 'text' : 'password'}
              prefix={<LockOutlined />}
              suffix={
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowPassword((v) => !v)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setShowPassword((v) => !v);
                    }
                  }}
                  aria-label={showPassword ? t('login.ariaHide') : t('login.ariaShow')}
                  style={{ cursor: 'pointer', display: 'inline-flex' }}
                >
                  {showPassword ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                </span>
              }
              placeholder="••••••••"
              size="large"
              maxLength={100}
            />
          </Form.Item>
          <div className="flex justify-end mb-4">
            <Link
              href="/forgot-password"
              className="text-xs hover:underline"
              style={{ color: 'rgb(var(--color-text-secondary))' }}
            >
              {t('login.forgotLink')}
            </Link>
          </div>
          <Form.Item className="!mb-0">
            <div className="flex justify-center pt-1">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                className="login-submit"
              >
                {t('login.submit')}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
