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
        'flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border bg-muted/30 p-10 text-center transition-colors hover:border-primary/40 hover:bg-primary/5'
      )}
    >
      <Upload className="size-8 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium text-foreground">Upload Business Assets</p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF, DOCX, PPTX, XLSX up to 50MB
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onMockUpload}>
        Select Files
      </Button>
    </div>
  );
}
