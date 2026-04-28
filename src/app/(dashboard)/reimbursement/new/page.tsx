'use client';

import { Typography } from 'antd';
import GlassCard from '@/components/GlassCard';
import ReimbursementForm from '@/components/forms/ReimbursementForm';
import { useT } from '@/lib/i18n/provider';

const { Title, Text } = Typography;

export default function NewReimbursementPage() {
  const t = useT();
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Title level={2} style={{ margin: 0, color: 'rgb(var(--color-text-on-canvas))' }}>
          {t('reimbursement.newTitle')}
        </Title>
        <Text className="text-muted">{t('reimbursement.newSubtitle')}</Text>
      </div>
      <GlassCard className="p-6">
        <ReimbursementForm />
      </GlassCard>
    </div>
  );
}
