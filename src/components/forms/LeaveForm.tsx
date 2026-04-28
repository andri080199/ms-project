'use client';

import { App, Button, DatePicker, Form, Input, Select } from 'antd';
import { type Dayjs } from 'dayjs';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import UploadField from '@/components/UploadField';
import type { LeaveType } from '@prisma/client';
import { useT } from '@/lib/i18n/provider';

type FormValues = {
  dateRange: [Dayjs, Dayjs];
  leaveType: LeaveType;
  reason: string;
  attachmentUrl?: string;
};

const TYPE_KEYS: LeaveType[] = ['ANNUAL', 'SICK', 'PERSONAL', 'MATERNITY', 'UNPAID', 'OTHER'];

export default function LeaveForm() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { message } = App.useApp();
  const t = useT();
  const [form] = Form.useForm<FormValues>();
  const dateRange = Form.useWatch('dateRange', form);
  const days =
    dateRange?.[0] && dateRange?.[1]
      ? dateRange[1].startOf('day').diff(dateRange[0].startOf('day'), 'day') + 1
      : null;

  const typeOptions = useMemo(
    () => TYPE_KEYS.map((v) => ({ value: v, label: t(`leaveType.${v}`) })),
    [t],
  );

  async function onFinish(values: FormValues) {
    const [start, end] = values.dateRange;
    if (end.isBefore(start, 'day')) {
      message.error(t('leave.endAfterStart'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: start.startOf('day').toISOString(),
          endDate: end.startOf('day').toISOString(),
          leaveType: values.leaveType,
          reason: values.reason,
          attachmentUrl: values.attachmentUrl || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        message.error(json.error ?? t('common.saveFailed'));
        return;
      }
      message.success(t('leave.successSubmitted'));
      router.push('/leave');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form<FormValues>
      form={form}
      layout="vertical"
      onFinish={onFinish}
      className="space-y-6"
      initialValues={{ leaveType: 'ANNUAL' }}
    >
      <Form.Item
        label={t('leave.labelType')}
        name="leaveType"
        rules={[{ required: true, message: t('leave.typeRequired') }]}
      >
        <Select options={typeOptions} placeholder={t('leave.typePlaceholder')} />
      </Form.Item>

      <Form.Item
        label={t('leave.labelDateRange')}
        name="dateRange"
        rules={[{ required: true, message: t('leave.dateRequired') }]}
        extra={days != null ? <span className="text-xs text-muted">{t('leave.totalDaysLabel', { n: days })}</span> : null}
      >
        <DatePicker.RangePicker className="w-full" format="DD MMM YYYY" />
      </Form.Item>

      <Form.Item
        label={t('leave.labelReason')}
        name="reason"
        rules={[
          { required: true, message: t('leave.reasonRequired') },
          { min: 5, message: t('leave.reasonMin') },
          { max: 1000, message: t('leave.reasonMax') },
        ]}
      >
        <Input.TextArea rows={4} placeholder={t('leave.reasonPlaceholder')} showCount maxLength={1000} />
      </Form.Item>

      <Form.Item
        label={t('leave.labelAttachment')}
        name="attachmentUrl"
        tooltip={t('leave.attachmentTooltip')}
      >
        <UploadField buttonLabel={t('leave.uploadButton')} />
      </Form.Item>

      <Button type="primary" htmlType="submit" loading={loading} block size="large">
        {t('leave.submit')}
      </Button>
    </Form>
  );
}
