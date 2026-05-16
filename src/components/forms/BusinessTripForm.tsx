'use client';

import { App, Button, DatePicker, Form, Input, Select } from 'antd';
import { type Dayjs } from 'dayjs';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { isWeekendRange } from '@/lib/utils';
import UploadField from '@/components/UploadField';
import { useT } from '@/lib/i18n/provider';

type FormValues = {
  range: [Dayjs, Dayjs];
  destination: string;
  purpose: string;
  tripType: 'WEEKDAY' | 'WEEKEND';
  attachmentUrl?: string;
};

export default function BusinessTripForm() {
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { message } = App.useApp();
  const t = useT();

  const tripTypeOptions = useMemo(
    () => [
      { value: 'WEEKDAY', label: t('tripType.WEEKDAY') },
      { value: 'WEEKEND', label: t('tripType.WEEKEND') },
    ],
    [t],
  );

  function handleValuesChange(changed: Partial<FormValues>) {
    if (!changed.range) return;
    const [start, end] = changed.range;
    if (start && end) {
      const auto = isWeekendRange(start.toDate(), end.toDate()) ? 'WEEKEND' : 'WEEKDAY';
      form.setFieldValue('tripType', auto);
    }
  }

  async function onFinish(values: FormValues) {
    const [start, end] = values.range;
    const days = end.startOf('day').diff(start.startOf('day'), 'day') + 1;
    if (days > 30) {
      message.error(t('businessTrip.max30days'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/business-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          destination: values.destination,
          purpose: values.purpose,
          tripType: values.tripType,
          attachmentUrl: values.attachmentUrl || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        message.error(json.error ?? t('common.saveFailed'));
        return;
      }
      message.success(t('businessTrip.successSubmitted'));
      router.push('/business-trip');
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
      onValuesChange={handleValuesChange}
      className="space-y-6"
    >
      <Form.Item
        label={t('businessTrip.labelDates')}
        name="range"
        rules={[{ required: true, message: t('businessTrip.datesRequired') }]}
      >
        <DatePicker.RangePicker
          className="w-full"
          format="DD MMM YYYY"
          classNames={{ popup: { root: 'app-date-popup single-month-panel' } }}
        />
      </Form.Item>

      <Form.Item
        label={t('businessTrip.labelDestination')}
        name="destination"
        rules={[
          { required: true, message: t('businessTrip.destinationRequired') },
          { min: 2, max: 200 },
        ]}
      >
        <Input placeholder={t('businessTrip.destinationPlaceholder')} maxLength={200} />
      </Form.Item>

      <Form.Item
        label={t('businessTrip.labelPurpose')}
        name="purpose"
        rules={[
          { required: true, message: t('businessTrip.purposeRequired') },
          { min: 30, message: t('businessTrip.purposeMin') },
          { max: 1000 },
        ]}
      >
        <Input.TextArea rows={4} maxLength={1000} showCount placeholder={t('businessTrip.purposePlaceholder')} />
      </Form.Item>

      <Form.Item label={t('businessTrip.labelTripType')} name="tripType" rules={[{ required: true }]} initialValue="WEEKDAY">
        <Select
          options={tripTypeOptions}
          classNames={{ popup: { root: 'app-select-popup' } }}
        />
      </Form.Item>

      <Form.Item
        label={t('businessTrip.labelAttachment')}
        name="attachmentUrl"
        tooltip={t('businessTrip.attachmentTooltip')}
      >
        <UploadField buttonLabel={t('businessTrip.uploadButton')} />
      </Form.Item>

      <div className="flex justify-end pt-2">
        <Button
          type="primary"
          htmlType="submit"
          loading={loading}
          style={{ boxShadow: '0 8px 18px -4px rgb(var(--color-primary-900) / 0.95), 0 2px 6px -2px rgb(var(--color-primary-700) / 0.6)' }}
        >
          {t('businessTrip.submit')}
        </Button>
      </div>

      <div className="text-xs text-muted" dangerouslySetInnerHTML={{ __html: t('businessTrip.autoWeekendNote') }} />
    </Form>
  );
}
