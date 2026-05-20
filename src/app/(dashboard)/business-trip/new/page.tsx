'use client';

// Thin wrapper page that renders BusinessTripForm inside a glass card with a page header.

import GlassCard from '@/components/GlassCard';
import PageHeader, { PageTitle } from '@/components/PageHeader';
import BusinessTripForm from '@/components/forms/BusinessTripForm';
import { useT } from '@/lib/i18n/provider';

export default function NewBusinessTripPage() {
  const t = useT();
  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader>
        <PageTitle title={t('businessTrip.newTitle')} subtitle={t('businessTrip.newSubtitle')} />
      </PageHeader>
      <GlassCard className="p-3 md:p-6">
        <BusinessTripForm />
      </GlassCard>
    </div>
  );
}
