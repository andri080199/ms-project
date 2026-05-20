'use client';

// Required AntD patch for React 19 compatibility — must be imported before any AntD components.
import '@ant-design/v5-patch-for-react-19';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider, App as AntApp, theme } from 'antd';
import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';
import { colors, semantic } from '@/lib/theme';
import { I18nProvider } from '@/lib/i18n/provider';

// Top-level client providers wrapping the entire app.
// Order matters: SessionProvider → AntdRegistry (SSR CSS injection) → ConfigProvider (theme) →
// AntApp (message/modal context) → I18nProvider (translation + locale state).
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AntdRegistry>
        <ConfigProvider
          theme={{
            // Dark algorithm as the base, overridden with the app's violet/iris palette.
            algorithm: theme.darkAlgorithm,
            token: {
              colorPrimary: semantic.primary,
              // Transparent container so glass cards show through properly.
              colorBgContainer: 'transparent',
              // Slightly translucent deep violet for elevated surfaces (dropdowns, modals).
              colorBgElevated: `${colors.bg.elevated}E6`,
              borderRadius: 12,
              fontFamily: "'Manrope', ui-sans-serif, system-ui, sans-serif",
              colorText: colors.text.primary,
              colorTextSecondary: colors.text.secondary,
              colorSuccess: colors.status.success,
              colorWarning: colors.status.warning,
              colorError: colors.status.danger,
              colorInfo: colors.status.info,
            },
            components: {
              // Uniform 40px height for all major form controls.
              Button: { controlHeight: 40, fontWeight: 600 },
              Input: { controlHeight: 40 },
              Select: { controlHeight: 40 },
              DatePicker: { controlHeight: 40 },
              InputNumber: { controlHeight: 40 },
              Menu: {
                itemBg: 'transparent',
                // Selected item uses a semi-transparent primary tint.
                itemSelectedBg: `${colors.primary[400]}2E`,
                itemHoverBg: '#FFFFFF0F',
                itemSelectedColor: colors.primary[200],
              },
              Table: { headerBg: 'transparent' },
            },
          }}
        >
          <AntApp>
            <I18nProvider>{children}</I18nProvider>
          </AntApp>
        </ConfigProvider>
      </AntdRegistry>
    </SessionProvider>
  );
}
