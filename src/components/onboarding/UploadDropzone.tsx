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
        'flex flex-col items-center gap-4 rounded-[1.5rem] border-2 border-dashed border-[#ead8d3] bg-white/60 p-10 text-center transition-colors hover:border-[#d14a2e] hover:bg-[#aa3016]/[0.03]'
      )}
    >
      <Upload className="size-8 text-[#645d58]" />
      <div>
        <p className="text-sm font-medium text-[#251816]">Drop files here or click to upload</p>
        <p className="mt-1 text-xs text-[#645d58]">
          PDF, DOCX, PPTX, XLSX up to 50MB
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onMockUpload}>
        Browse files
      </Button>
    </div>
  );
}
