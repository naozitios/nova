import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type UploadDropzoneProps = {
  onMockUpload: () => void;
};

export function UploadDropzone({ onMockUpload }: UploadDropzoneProps) {
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
      <Button type="button" variant="secondary" onClick={onMockUpload}>
        Select Files
      </Button>
    </div>
  );
}
