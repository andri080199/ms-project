'use client';

import { Button, Typography } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import { useI18n } from '@/lib/i18n/provider';

const { Text } = Typography;

export default function Header({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const { t } = useI18n();

  return (
    <header className="glass md:hidden mx-4 mt-4 mb-2 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={onToggleSidebar}
          style={{ color: 'rgb(var(--color-text-primary))' }}
          aria-label="Open menu"
        />
        <Text strong style={{ color: 'rgb(var(--color-text-primary))' }}>
          {t('brand.name')}
        </Text>
      </div>
    </header>
  );
}
