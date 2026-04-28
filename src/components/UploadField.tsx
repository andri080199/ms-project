'use client';

import { App, Button, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/provider';

type Props = {
  value?: string | null;
  onChange?: (url: string | undefined) => void;
  accept?: string;
  buttonLabel?: string;
};

export default function UploadField({
  value,
  onChange,
  accept = 'image/png,image/jpeg,image/webp,application/pdf',
  buttonLabel,
}: Props) {
  const { message } = App.useApp();
  const t = useT();
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const label = buttonLabel ?? t('upload.defaultButton');

  useEffect(() => {
    if (value) {
      setFileList([
        {
          uid: '-1',
          name: value.split('/').pop() ?? 'file',
          status: 'done',
          url: value,
        },
      ]);
    } else {
      setFileList([]);
    }
  }, [value]);

  async function doUpload(file: File): Promise<string | null> {
    const fd = new FormData();
    fd.append('file', file);
    setUploading(true);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || !json.success) {
        message.error(json.error ?? t('upload.failed'));
        return null;
      }
      return json.data.url as string;
    } catch {
      message.error(t('upload.failed'));
      return null;
    } finally {
      setUploading(false);
    }
  }

  return (
    <Upload
      accept={accept}
      fileList={fileList}
      maxCount={1}
      beforeUpload={async (file) => {
        const url = await doUpload(file);
        if (url) {
          setFileList([{ uid: '-1', name: file.name, status: 'done', url }]);
          onChange?.(url);
        }
        return false;
      }}
      onRemove={() => {
        setFileList([]);
        onChange?.(undefined);
        return true;
      }}
    >
      {fileList.length === 0 && (
        <Button icon={<UploadOutlined />} loading={uploading}>
          {label}
        </Button>
      )}
    </Upload>
  );
}
