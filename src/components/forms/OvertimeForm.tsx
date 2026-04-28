'use client';

import { App, Button, DatePicker, Form, Input, TimePicker } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import UploadField from '@/components/UploadField';
import { useT } from '@/lib/i18n/provider';

type FormValues = {
  date: Dayjs;
  timeRange: [Dayjs, Dayjs];
  reason: string;
  attachmentUrl?: string;
};

export default function OvertimeForm() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { message } = App.useApp();
  const t = useT();

  async function onFinish(values: FormValues) {
    const [start, end] = values.timeRange;
    if (!end.isAfter(start)) {
      message.error(t('overtime.endAfterStart'));
      return;
    }
    setLoading(true);
    try {
      const date = values.date.startOf('day');
      const startTime = date.hour(start.hour()).minute(start.minute()).second(0);
      const endTime = date.hour(end.hour()).minute(end.minute()).second(0);
      const res = await fetch('/api/overtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: date.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          reason: values.reason,
          attachmentUrl: values.attachmentUrl || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        message.error(json.error ?? t('common.saveFailed'));
        return;
      }
      message.success(t('overtime.successSubmitted'));
      router.push('/overtime');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form<FormValues>
      layout="vertical"
      onFinish={onFinish}
      className="space-y-6"
      initialValues={{ date: dayjs() }}
    >
      <Form.Item
        label={t('overtime.labelDate')}
        name="date"
        rules={[
          { required: true, message: t('overtime.dateRequired') },
          {
            validator: async (_, value: Dayjs) => {
              if (!value) return;
              const diff = value.startOf('day').diff(dayjs().startOf('day'), 'day');
              if (diff < -30) throw new Error(t('overtime.datePast'));
              if (diff > 14) throw new Error(t('overtime.dateFuture'));
            },
          },
        ]}
      >
        <DatePicker className="w-full" format="DD MMM YYYY" />
      </Form.Item>

      <Form.Item
        label={t('overtime.labelTimeRange')}
        name="timeRange"
        rules={[{ required: true, message: t('overtime.timeRequired') }]}
      >
        <TimePicker.RangePicker className="w-full" minuteStep={15} format="HH:mm" />
      </Form.Item>

      <Form.Item
        label={t('overtime.labelReason')}
        name="reason"
        rules={[
          { required: true, message: t('overtime.reasonRequired') },
          { min: 10, message: t('overtime.reasonMin') },
          { max: 1000, message: t('overtime.reasonMax') },
        ]}
      >
        <Input.TextArea rows={4} placeholder={t('overtime.reasonPlaceholder')} showCount maxLength={1000} />
      </Form.Item>

      <Form.Item
        label={t('overtime.labelAttachment')}
        name="attachmentUrl"
        tooltip={t('overtime.attachmentTooltip')}
      >
        <UploadField buttonLabel={t('overtime.uploadButton')} />
      </Form.Item>

      <Button type="primary" htmlType="submit" loading={loading} block size="large">
        {t('overtime.submit')}
      </Button>
    </Form>
  );
}
