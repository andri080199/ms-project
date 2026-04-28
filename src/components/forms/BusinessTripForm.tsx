'use client';

import { App, Button, DatePicker, Form, Input, Radio } from 'antd';
import { type Dayjs } from 'dayjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
  const range = Form.useWatch('range', form);

  useEffect(() => {
    if (range && range[0] && range[1]) {
      const auto = isWeekendRange(range[0].toDate(), range[1].toDate()) ? 'WEEKEND' : 'WEEKDAY';
      form.setFieldValue('tripType', auto);
    }
  }, [range, form]);

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
    <Form<FormValues> form={form} layout="vertical" onFinish={onFinish} className="space-y-6">
      <Form.Item
        label={t('businessTrip.labelDates')}
        name="range"
        rules={[{ required: true, message: t('businessTrip.datesRequired') }]}
      >
        <DatePicker.RangePicker className="w-full" format="DD MMM YYYY" />
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
          { min: 10, message: t('businessTrip.purposeMin') },
          { max: 1000 },
        ]}
      >
        <Input.TextArea rows={4} maxLength={1000} showCount placeholder={t('businessTrip.purposePlaceholder')} />
      </Form.Item>

      <Form.Item label={t('businessTrip.labelTripType')} name="tripType" rules={[{ required: true }]} initialValue="WEEKDAY">
        <Radio.Group>
          <Radio.Button value="WEEKDAY">{t('tripType.WEEKDAY')}</Radio.Button>
          <Radio.Button value="WEEKEND">{t('tripType.WEEKEND')}</Radio.Button>
        </Radio.Group>
      </Form.Item>

      <Form.Item
        label={t('businessTrip.labelAttachment')}
        name="attachmentUrl"
        tooltip={t('businessTrip.attachmentTooltip')}
      >
        <UploadField buttonLabel={t('businessTrip.uploadButton')} />
      </Form.Item>

      <Button type="primary" htmlType="submit" loading={loading} block size="large">
        {t('businessTrip.submit')}
      </Button>

      <div className="text-xs text-muted" dangerouslySetInnerHTML={{ __html: t('businessTrip.autoWeekendNote') }} />
    </Form>
  );
}
