'use client';

// Forgot password page. Always shows a success message regardless of whether the email
// is registered — this is intentional anti-enumeration design (the API does the same).

import { Button, Form, Input, Typography, App, Dropdown } from 'antd';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  GlobalOutlined,
  MailOutlined,
} from '@ant-design/icons';
import { useI18n } from '@/lib/i18n/provider';
import { LOCALES, LOCALE_LABEL, LOCALE_SHORT } from '@/lib/i18n/dict';

const { Text } = Typography;

type FormValues = { email: string };

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const { message } = App.useApp();
  const { locale, setLocale, t } = useI18n();

  async function onFinish(values: FormValues) {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email }),
      });
      // Selalu treat as success — backend pun selalu return success (anti enumeration).
      if (!res.ok) {
        // Cuma error kalo input malformed dari sisi client.
        message.error(t('forgotPassword.invalidEmail'));
        return;
      }
      setSubmittedEmail(values.email);
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
            <Text className="text-muted text-xs">{t('forgotPassword.hint')}</Text>
          </div>
        </div>

        {submittedEmail ? (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <CheckCircleOutlined style={{ fontSize: 48, color: '#16a34a' }} />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                {t('forgotPassword.successTitle')}
              </h2>
              <Text className="text-muted text-sm block">
                {t('forgotPassword.successBody').replace('{email}', submittedEmail)}
              </Text>
              <Text className="text-muted text-xs block pt-2">
                {t('forgotPassword.successNote')}
              </Text>
            </div>
            <div className="pt-2">
              <Link href="/login">
                <Button type="primary" size="large" icon={<ArrowLeftOutlined />} className="login-submit">
                  {t('forgotPassword.backToLogin')}
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            <Form<FormValues> layout="vertical" onFinish={onFinish} autoComplete="off">
              <Form.Item
                label={t('login.emailLabel')}
                name="email"
                rules={[
                  { required: true, message: t('login.emailRequired') },
                  { type: 'email', message: t('login.emailInvalid') },
                ]}
              >
                <Input
                  prefix={<MailOutlined />}
                  placeholder={t('login.emailPlaceholder')}
                  size="large"
                  maxLength={150}
                />
              </Form.Item>
              <Form.Item className="!mb-0">
                <div className="flex justify-center pt-1">
                  <Button type="primary" htmlType="submit" loading={loading} className="login-submit">
                    {t('forgotPassword.submit')}
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
