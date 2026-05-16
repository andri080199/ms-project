'use client';

import { App, Button, DatePicker, Form, Input, Select, TimePicker } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import UploadField from '@/components/UploadField';
import { useT } from '@/lib/i18n/provider';

type FormValues = {
  date: Dayjs;
  startTime: Dayjs;
  overtimeType: 'PREMIUM_SHIFT' | 'OVERDAYS';
  duration: Dayjs;
  reason: string;
  attachmentUrl?: string;
};

export default function OvertimeForm() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { message } = App.useApp();
  const t = useT();

  const overtimeTypeOptions = useMemo(
    () => [
      { value: 'PREMIUM_SHIFT', label: t('overtime.typePremiumShift') },
      { value: 'OVERDAYS', label: t('overtime.typeOverdays') },
    ],
    [t],
  );

  async function onFinish(values: FormValues) {
    const totalMinutes = values.duration.hour() * 60 + values.duration.minute();
    if (totalMinutes <= 0) {
      message.error(t('overtime.durationRequired'));
      return;
    }
    setLoading(true);
    try {
      const date = values.date.startOf('day');
      const startTime = date.hour(values.startTime.hour()).minute(values.startTime.minute()).second(0);
      const res = await fetch('/api/overtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: date.toISOString(),
          startTime: startTime.toISOString(),
          overtimeType: values.overtimeType,
          durationMinutes: totalMinutes,
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
      initialValues={{ date: dayjs(), duration: dayjs().hour(1).minute(0) }}
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
        <DatePicker
          className="w-full"
          format="DD MMM YYYY"
          classNames={{ popup: { root: 'app-date-popup' } }}
        />
      </Form.Item>

      <Form.Item
        label={t('overtime.labelOvertimeType')}
        name="overtimeType"
        rules={[{ required: true, message: t('overtime.overtimeTypeRequired') }]}
      >
        <Select
          options={overtimeTypeOptions}
          placeholder={t('overtime.overtimeTypePlaceholder')}
          classNames={{ popup: { root: 'app-select-popup' } }}
        />
      </Form.Item>

      <Form.Item
        label={t('overtime.labelStartTime')}
        name="startTime"
        rules={[{ required: true, message: t('overtime.startTimeRequired') }]}
      >
        <TimePicker className="w-full" minuteStep={1} format="HH:mm" />
      </Form.Item>

      <Form.Item
        label={t('overtime.labelDuration')}
        name="duration"
        tooltip={t('overtime.durationTooltip')}
        rules={[{ required: true, message: t('overtime.durationRequired') }]}
      >
        <TimePicker className="w-full" minuteStep={1} format="HH:mm" showNow={false} />
      </Form.Item>

      <Form.Item
        label={t('overtime.labelReason')}
        name="reason"
        rules={[
          { required: true, message: t('overtime.reasonRequired') },
          { min: 30, message: t('overtime.reasonMin') },
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

      <div className="flex justify-end pt-2">
        <Button
          type="primary"
          htmlType="submit"
          loading={loading}
          style={{ boxShadow: '0 8px 18px -4px rgb(var(--color-primary-900) / 0.95), 0 2px 6px -2px rgb(var(--color-primary-700) / 0.6)' }}
        >
          {t('overtime.submit')}
        </Button>
      </div>
    </Form>
  );
}
