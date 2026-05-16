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
  category: 'KANDUNGAN' | 'KACAMATA' | 'GAS_FUEL' | 'TRANSPORTATION' | 'PARKING' | 'CLIENT_ENTERTAINMENT' | 'ATK_OFFICE' | 'OFFICE_MAINTENANCE' | 'TOLL' | 'PRODUCT_DEV' | 'HOTEL_DINAS' | 'MEDICAL_BOD';
  amount: number;
  transactionDate: Dayjs;
  description: string;
  receiptUrl?: string;
};

const CATEGORY_KEYS: Item['category'][] = [
  'KANDUNGAN', 'KACAMATA', 'GAS_FUEL', 'TRANSPORTATION', 'PARKING',
  'CLIENT_ENTERTAINMENT', 'ATK_OFFICE', 'OFFICE_MAINTENANCE', 'TOLL',
  'PRODUCT_DEV', 'HOTEL_DINAS', 'MEDICAL_BOD',
];

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
          { category: 'TRANSPORTATION', amount: 0, transactionDate: dayjs(), description: '', receiptUrl: undefined },
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
                    <Select
                      options={categoryOptions}
                      classNames={{ popup: { root: 'app-select-popup' } }}
                    />
                  </Form.Item>
                  <Form.Item
                    label={t('reimbursement.labelTxDate')}
                    name={[field.name, 'transactionDate']}
                    rules={[{ required: true, message: t('reimbursement.txDateRequired') }]}
                  >
                    <DatePicker
                      className="w-full"
                      format="DD MMM YYYY"
                      classNames={{ popup: { root: 'app-date-popup' } }}
                    />
                  </Form.Item>
                </div>
                <Form.Item
                  label={t('reimbursement.labelAmount')}
                  name={[field.name, 'amount']}
                  rules={[
                    { required: true, message: t('reimbursement.amountRequired') },
                    { type: 'number', min: 1, message: t('reimbursement.amountPositive') },
                    { type: 'number', max: 9999999999, message: t('reimbursement.amountMax') },
                  ]}
                >
                  <InputNumber
                    className="w-full"
                    min={0}
                    max={9999999999}
                    step={1000}
                    controls={false}
                    inputMode="numeric"
                    onKeyDown={(e) => {
                      const allowed = [
                        'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight',
                        'ArrowUp', 'ArrowDown', 'Tab', 'Home', 'End',
                        'Enter', 'Escape',
                      ];
                      if (allowed.includes(e.key)) return;
                      if (e.ctrlKey || e.metaKey) return;
                      if (!/^\d$/.test(e.key)) {
                        e.preventDefault();
                        return;
                      }
                      const el = e.currentTarget;
                      const digitCount = el.value.replace(/\D/g, '').length;
                      const selStart = el.selectionStart ?? 0;
                      const selEnd = el.selectionEnd ?? 0;
                      const selectedDigits = el.value
                        .slice(selStart, selEnd)
                        .replace(/\D/g, '').length;
                      if (digitCount - selectedDigits >= 10) {
                        e.preventDefault();
                      }
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
                      if (!pasted) return;
                      const el = e.currentTarget;
                      const selStart = el.selectionStart ?? 0;
                      const selEnd = el.selectionEnd ?? el.value.length;
                      const beforeDigits = el.value.slice(0, selStart).replace(/\D/g, '');
                      const afterDigits = el.value.slice(selEnd).replace(/\D/g, '');
                      const combined = (beforeDigits + pasted + afterDigits).slice(0, 10);
                      // Trigger native input event so React/AntD picks up the new value
                      const setter = Object.getOwnPropertyDescriptor(
                        window.HTMLInputElement.prototype, 'value',
                      )?.set;
                      setter?.call(el, combined);
                      el.dispatchEvent(new Event('input', { bubbles: true }));
                    }}
                    formatter={(v) => `Rp ${String(v ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`}
                    parser={((v?: string) => {
                      const digits = (v ?? '').replace(/\D/g, '').slice(0, 10);
                      return digits ? Number(digits) : 0;
                    }) as never}
                  />
                </Form.Item>
                <Form.Item
                  label={t('reimbursement.labelDescription')}
                  name={[field.name, 'description']}
                  rules={[
                    { required: true, message: t('reimbursement.descRequired') },
                    { min: 3, message: t('reimbursement.descMin') },
                    {
                      validator: (_, v: string) => {
                        const words = (v ?? '').trim().split(/\s+/).filter(Boolean).length;
                        return words > 100
                          ? Promise.reject(new Error(t('reimbursement.descMax')))
                          : Promise.resolve();
                      },
                    },
                  ]}
                >
                  <Input placeholder={t('reimbursement.descPlaceholder')} />
                </Form.Item>
                <Form.Item
                  label={t('reimbursement.labelReceipt')}
                  name={[field.name, 'receiptUrl']}
                  tooltip={t('reimbursement.receiptTooltip')}
                  rules={[{ required: true, message: t('reimbursement.receiptRequired') }]}
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

            <div className="flex justify-center pt-1">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() =>
                  add({
                    category: 'TRANSPORTATION',
                    amount: 0,
                    transactionDate: dayjs(),
                    description: '',
                    receiptUrl: undefined,
                  })
                }
                style={{
                  boxShadow:
                    '0 8px 18px -4px rgb(var(--color-primary-900) / 0.95), 0 2px 6px -2px rgb(var(--color-primary-700) / 0.6)',
                }}
              >
                {t('reimbursement.addItem')}
              </Button>
            </div>
          </div>
        )}
      </Form.List>

      <div className="glass p-3 md:p-4 flex items-center justify-between">
        <span className="text-muted text-xs md:text-sm">{t('reimbursement.totalLabel')}</span>
        <span className="text-sm md:text-lg font-bold">{formatRupiah(total)}</span>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          type="primary"
          htmlType="submit"
          loading={loading}
          style={{ boxShadow: '0 8px 18px -4px rgb(var(--color-primary-900) / 0.95), 0 2px 6px -2px rgb(var(--color-primary-700) / 0.6)' }}
        >
          {t('reimbursement.submit')}
        </Button>
      </div>
    </Form>
  );
}
