'use client';

import '@ant-design/v5-patch-for-react-19';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider, App as AntApp, theme } from 'antd';
import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';
import { colors, semantic } from '@/lib/theme';
import { I18nProvider } from '@/lib/i18n/provider';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AntdRegistry>
        <ConfigProvider
          theme={{
            algorithm: theme.darkAlgorithm,
            token: {
              colorPrimary: semantic.primary,
              colorBgContainer: 'transparent',
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
              Button: { controlHeight: 40, fontWeight: 600 },
              Input: { controlHeight: 40 },
              Select: { controlHeight: 40 },
              DatePicker: { controlHeight: 40 },
              InputNumber: { controlHeight: 40 },
              Menu: {
                itemBg: 'transparent',
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
