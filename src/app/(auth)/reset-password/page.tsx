'use client';

// Password reset page. The reset token is read from ?token= in the URL.
// Missing or invalid tokens show an error state with a link to request a new one.
// Wrapped in Suspense because the inner component calls useSearchParams.

import { Button, Form, Input, Typography, App, Dropdown } from 'antd';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  GlobalOutlined,
  LockOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useI18n } from '@/lib/i18n/provider';
import { LOCALES, LOCALE_LABEL, LOCALE_SHORT } from '@/lib/i18n/dict';

const { Text } = Typography;

type FormValues = { password: string; confirm: string };

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get('token') ?? '';
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { message } = App.useApp();
  const { locale, setLocale, t } = useI18n();

  async function onFinish(values: FormValues) {
    if (!token) {
      message.error(t('resetPassword.missingToken'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: values.password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        message.error(data?.error ?? t('resetPassword.failedGeneric'));
        return;
      }
      message.success(t('resetPassword.successToast'));
      router.push('/login');
    } catch {
      message.error(t('forgotPassword.networkError'));
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
            <Text className="text-muted text-xs">{t('resetPassword.hint')}</Text>
          </div>
        </div>

        {!token ? (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <WarningOutlined style={{ fontSize: 48, color: '#dc2626' }} />
            </div>
            <Text className="text-muted text-sm block">{t('resetPassword.missingToken')}</Text>
            <div className="pt-2">
              <Link href="/forgot-password">
                <Button type="primary" size="large" className="login-submit">
                  {t('resetPassword.requestNew')}
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            <Form<FormValues> layout="vertical" onFinish={onFinish} autoComplete="off">
              <Form.Item
                label={t('resetPassword.newPasswordLabel')}
                name="password"
                rules={[
                  { required: true, message: t('login.passwordRequired') },
                  { min: 6, message: t('resetPassword.minLength') },
                  { max: 200, message: t('resetPassword.maxLength') },
                ]}
                hasFeedback
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
                  maxLength={200}
                />
              </Form.Item>
              <Form.Item
                label={t('resetPassword.confirmPasswordLabel')}
                name="confirm"
                dependencies={['password']}
                hasFeedback
                rules={[
                  { required: true, message: t('resetPassword.confirmRequired') },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error(t('resetPassword.mismatch')));
                    },
                  }),
                ]}
              >
                <Input
                  type={showConfirm ? 'text' : 'password'}
                  prefix={<LockOutlined />}
                  suffix={
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => setShowConfirm((v) => !v)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setShowConfirm((v) => !v);
                        }
                      }}
                      aria-label={showConfirm ? t('login.ariaHide') : t('login.ariaShow')}
                      style={{ cursor: 'pointer', display: 'inline-flex' }}
                    >
                      {showConfirm ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                    </span>
                  }
                  placeholder="••••••••"
                  size="large"
                  maxLength={200}
                />
              </Form.Item>
              <Form.Item className="!mb-0">
                <div className="flex justify-center pt-1">
                  <Button type="primary" htmlType="submit" loading={loading} className="login-submit">
                    {t('resetPassword.submit')}
                  </Button>
                </div>
              </Form.Item>
            </Form>
            <div className="text-center">
              <Link
                href="/login"
                className="text-xs hover:underline"
                style={{ color: 'rgb(var(--color-text-secondary))' }}
              >
                <ArrowLeftOutlined /> {t('forgotPassword.backToLogin')}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
