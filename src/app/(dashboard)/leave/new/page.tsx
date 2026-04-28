'use client';

import { Typography } from 'antd';
import GlassCard from '@/components/GlassCard';
import LeaveForm from '@/components/forms/LeaveForm';
import { useT } from '@/lib/i18n/provider';

const { Title, Text } = Typography;

export default function NewLeavePage() {
  const t = useT();
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Title level={2} style={{ margin: 0, color: 'rgb(var(--color-text-on-canvas))' }}>
          {t('leave.newTitle')}
        </Title>
        <Text className="text-muted">{t('leave.newSubtitle')}</Text>
      </div>
      <GlassCard className="p-6">
        <LeaveForm />
      </GlassCard>
    </div>
  );
}
