'use client';

import GlassCard from '@/components/GlassCard';
import PageHeader, { PageTitle } from '@/components/PageHeader';
import OvertimeForm from '@/components/forms/OvertimeForm';
import { useT } from '@/lib/i18n/provider';

export default function NewOvertimePage() {
  const t = useT();
  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader>
        <PageTitle title={t('overtime.newTitle')} subtitle={t('overtime.newSubtitle')} />
      </PageHeader>
      <GlassCard className="p-3 md:p-6">
        <OvertimeForm />
      </GlassCard>
    </div>
  );
}
