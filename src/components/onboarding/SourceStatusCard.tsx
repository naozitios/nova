import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import type { MockSource } from '@/lib/onboarding/types';
import { cn } from '@/lib/utils';

type SourceStatusCardProps = {
  source: MockSource;
};

function SourceIcon({ status }: { status: MockSource['status'] }) {
  if (status === 'complete') return <CheckCircle2 className="size-4 text-[#aa3016]" />;
  if (status === 'failed') return <AlertCircle className="size-4 text-red-500" />;
  return <Loader2 className="size-4 animate-spin text-[#8d716b]" />;
}

function SourceStatusLabel({ status }: { status: MockSource['status'] }) {
  const labels: Record<MockSource['status'], string> = {
    added: 'Queued',
    uploading: 'Uploading',
    processing: 'Processing',
    complete: 'Complete',
    failed: 'Failed',
  };
  return <span>{labels[status]}</span>;
}

export function SourceStatusCard({ source }: SourceStatusCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#ead8d3] bg-white/85 px-4 py-3">
      <SourceIcon status={source.status} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#251816]">{source.sourceName}</p>
        <p className="text-xs text-[#8d716b]">{source.sourceType}</p>
        {source.progress > 0 && source.progress < 100 && (
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#ead8d3]">
            <div
              className="h-full rounded-full bg-[#aa3016] transition-all"
              style={{ width: `${source.progress}%` }}
            />
          </div>
        )}
        {source.error && (
          <p className="mt-1 text-xs text-red-500">{source.error}</p>
        )}
      </div>
      <span
        className={cn(
          'text-xs font-medium',
          source.status === 'complete' && 'text-[#aa3016]',
          source.status === 'failed' && 'text-red-500',
          (source.status === 'processing' || source.status === 'uploading' || source.status === 'added') && 'text-[#8d716b]'
        )}
      >
        <SourceStatusLabel status={source.status} />
      </span>
    </div>
  );
}
