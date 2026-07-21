'use client';

import { useRef, useCallback } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type UploadDropzoneProps = {
  onMockUpload?: () => void;
  onFileSelect: (files: FileList) => void;
};

export function UploadDropzone({ onMockUpload, onFileSelect }: UploadDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFileSelect(files);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [onFileSelect],
  );

  return (
    <div
      className={cn(
        'group flex min-h-[240px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border bg-white p-6 text-center transition-all hover:border-primary hover:bg-primary/5 cursor-pointer'
      )}
    >
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-secondary group-hover:scale-110 transition-transform">
        <Upload className="size-8 text-primary" />
      </div>
      <h3 className="mb-2 text-xl font-semibold text-foreground">Upload Business Assets</h3>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">
        Drag and drop your PDF, PPTX, DOCX, or Image files here to train NOVA.
      </p>
      <input
        type="file"
        multiple
        accept=".pdf,.pptx,.docx,image/*"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
      />
      <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
        Select Files
      </Button>
    </div>
  );
}
