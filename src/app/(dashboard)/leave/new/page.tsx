'use client';

// Thin wrapper page that renders LeaveForm inside a glass card with a page header.

import GlassCard from '@/components/GlassCard';
import PageHeader, { PageTitle } from '@/components/PageHeader';
import LeaveForm from '@/components/forms/LeaveForm';
import { useT } from '@/lib/i18n/provider';

export default function NewLeavePage() {
  const t = useT();
  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader>
        <PageTitle title={t('leave.newTitle')} subtitle={t('leave.newSubtitle')} />
      </PageHeader>
      <GlassCard className="p-3 md:p-6">
        <LeaveForm />
      </GlassCard>
    </div>
  );
}
