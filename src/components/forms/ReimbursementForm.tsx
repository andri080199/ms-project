'use client';

import { App, Button, DatePicker, Form, Input, InputNumber, Select } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { formatRupiah } from '@/lib/utils';
import UploadField from '@/components/UploadField';
import { useT } from '@/lib/i18n/provider';

type Item = {
  category: 'OFFICE' | 'HOTEL' | 'TOLL' | 'TRANSPORTATION' | 'MEAL' | 'OTHER';
  amount: number;
  transactionDate: Dayjs;
  description: string;
  receiptUrl?: string;
};

const CATEGORY_KEYS: Item['category'][] = ['OFFICE', 'HOTEL', 'TOLL', 'TRANSPORTATION', 'MEAL', 'OTHER'];

export default function ReimbursementForm() {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm<{ items: Item[] }>();
  const router = useRouter();
  const { message } = App.useApp();
  const t = useT();
  const items = Form.useWatch('items', form) ?? [];
  const total = items.reduce((a, b) => a + (Number(b?.amount) || 0), 0);

  const categoryOptions = useMemo(
    () => CATEGORY_KEYS.map((k) => ({ value: k, label: t(`reimbCategory.${k}`) })),
    [t],
  );

  async function onFinish(values: { items: Item[] }) {
    if (!values.items?.length) {
      message.error(t('reimbursement.minOneItem'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/reimbursement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: values.items.map((it) => ({
            category: it.category,
            amount: Number(it.amount),
            transactionDate: it.transactionDate.toISOString(),
            description: it.description,
            receiptUrl: it.receiptUrl || undefined,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        message.error(json.error ?? t('common.saveFailed'));
        return;
      }
      message.success(t('reimbursement.successSubmitted'));
      router.push('/reimbursement');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form<{ items: Item[] }>
      form={form}
      layout="vertical"
      onFinish={onFinish}
      initialValues={{
        items: [
          { category: 'TRANSPORTATION', amount: 0, transactionDate: dayjs(), description: '' },
        ],
      }}
      className="space-y-6"
    >
      <Form.List name="items">
        {(fields, { add, remove }) => (
          <div className="space-y-4">
            {fields.map((field) => (
              <div key={field.key} className="glass p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Form.Item
                    label={t('reimbursement.labelCategory')}
                    name={[field.name, 'category']}
                    rules={[{ required: true, message: t('reimbursement.categoryRequired') }]}
                  >
                    <Select options={categoryOptions} />
                  </Form.Item>
                  <Form.Item
                    label={t('reimbursement.labelTxDate')}
                    name={[field.name, 'transactionDate']}
                    rules={[{ required: true, message: t('reimbursement.txDateRequired') }]}
                  >
                    <DatePicker className="w-full" format="DD MMM YYYY" />
                  </Form.Item>
                </div>
                <Form.Item
                  label={t('reimbursement.labelAmount')}
                  name={[field.name, 'amount']}
                  rules={[
                    { required: true, message: t('reimbursement.amountRequired') },
                    { type: 'number', min: 1, message: t('reimbursement.amountPositive') },
                  ]}
                >
                  <InputNumber
                    className="w-full"
                    min={0}
                    step={1000}
                    formatter={(v) => `Rp ${String(v ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`}
                    parser={((v?: string) => (v ? Number(v.replace(/\D/g, '')) : 0)) as never}
                  />
                </Form.Item>
                <Form.Item
                  label={t('reimbursement.labelDescription')}
                  name={[field.name, 'description']}
                  rules={[
                    { required: true, message: t('reimbursement.descRequired') },
                    { min: 3, message: t('reimbursement.descMin') },
                  ]}
                >
                  <Input placeholder={t('reimbursement.descPlaceholder')} maxLength={500} />
                </Form.Item>
                <Form.Item
                  label={t('reimbursement.labelReceipt')}
                  name={[field.name, 'receiptUrl']}
                  tooltip={t('reimbursement.receiptTooltip')}
                >
                  <UploadField buttonLabel={t('reimbursement.uploadReceipt')} />
                </Form.Item>
                {fields.length > 1 && (
                  <Button danger icon={<DeleteOutlined />} onClick={() => remove(field.name)}>
                    {t('reimbursement.deleteItem')}
                  </Button>
                )}
              </div>
            ))}

            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() =>
                add({
                  category: 'OTHER',
                  amount: 0,
                  transactionDate: dayjs(),
                  description: '',
                })
              }
              block
            >
              {t('reimbursement.addItem')}
            </Button>
          </div>
        )}
      </Form.List>

      <div className="glass p-4 flex items-center justify-between">
        <span className="text-muted">{t('reimbursement.totalLabel')}</span>
        <span className="text-lg font-bold">{formatRupiah(total)}</span>
      </div>

      <Button type="primary" htmlType="submit" loading={loading} block size="large">
        {t('reimbursement.submit')}
      </Button>
    </Form>
  );
}
