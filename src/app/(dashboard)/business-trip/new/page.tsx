'use client';

import { Typography } from 'antd';
import GlassCard from '@/components/GlassCard';
import BusinessTripForm from '@/components/forms/BusinessTripForm';
import { useT } from '@/lib/i18n/provider';

const { Title, Text } = Typography;

export default function NewBusinessTripPage() {
  const t = useT();
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Title level={2} style={{ margin: 0, color: 'rgb(var(--color-text-on-canvas))' }}>
          {t('businessTrip.newTitle')}
        </Title>
        <Text className="text-muted">{t('businessTrip.newSubtitle')}</Text>
      </div>
      <GlassCard className="p-6">
        <BusinessTripForm />
      </GlassCard>
    </div>
  );
}
