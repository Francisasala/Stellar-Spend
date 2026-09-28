'use client';

import { useRef, ChangeEvent } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n';

export interface FileUploadZoneProps {
  selectedFile: File | null;
  filePreview: string | null;
  onFileSelect: (file: File) => void;
  onError: (err: string) => void;
}

export function FileUploadZone({
  selectedFile,
  filePreview,
  onFileSelect,
  onError,
}: FileUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        onError('File size must be less than 5MB');
        return;
      }
      onFileSelect(file);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] tracking-widest uppercase text-[#777777]">
        {t('insurance.upload_document')}
      </label>
      <div
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed border-[#333333] p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#c9a962] transition-colors',
          filePreview && 'border-[#c9a962] bg-[#c9a962]/5',
        )}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,application/pdf"
        />
        {filePreview ? (
          <div className="flex flex-col items-center gap-2">
            {selectedFile?.type.startsWith('image/') ? (
              <span className="relative block h-20 w-20">
                <Image
                  src={filePreview}
                  alt="Preview"
                  fill
                  sizes="80px"
                  className="object-contain border border-[#333333]"
                />
              </span>
            ) : (
              <div className="w-12 h-12 bg-[#222222] flex items-center justify-center text-xs">
                PDF
              </div>
            )}
            <span className="text-[10px] text-white truncate max-w-[200px]">
              {selectedFile?.name}
            </span>
          </div>
        ) : (
          <>
            <span className="text-xl opacity-30">↑</span>
            <span className="text-[10px] text-[#555555] uppercase tracking-widest">
              Click to upload JPG, PNG or PDF (max 5MB)
            </span>
          </>
        )}
      </div>
    </div>
  );
}
