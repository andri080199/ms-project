'use client';

import GlassCard from '@/components/GlassCard';
import PageHeader, { PageTitle } from '@/components/PageHeader';
import ReimbursementForm from '@/components/forms/ReimbursementForm';
import { useT } from '@/lib/i18n/provider';

export default function NewReimbursementPage() {
  const t = useT();
  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader>
        <PageTitle title={t('reimbursement.newTitle')} subtitle={t('reimbursement.newSubtitle')} />
      </PageHeader>
      <GlassCard className="p-3 md:p-6">
        <ReimbursementForm />
      </GlassCard>
    </div>
  );
}
