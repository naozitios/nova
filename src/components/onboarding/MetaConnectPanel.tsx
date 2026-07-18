import { Button } from '@/components/ui/button';
import type { MetaConnectionStatus } from '@/lib/onboarding/types';
import { CheckCircle2, Link2, AlertTriangle, SkipForward } from 'lucide-react';

type MetaConnectPanelProps = {
  status: MetaConnectionStatus;
  onConnect: () => void;
  onSkip: () => void;
  onRetry: () => void;
};

export function MetaConnectPanel({ status, onConnect, onSkip, onRetry }: MetaConnectPanelProps) {
  return (
    <div className="rounded-2xl border border-[#ead8d3] bg-white/80 p-6 shadow-sm">
      {status === 'not_connected' && (
        <>
          <div className="flex items-center gap-2">
            <Link2 className="size-4 text-stone-500" />
            <h3 className="text-sm font-semibold text-stone-800">Connect Meta</h3>
          </div>
          <p className="mt-2 text-sm text-stone-600">
            Connect your Meta account to pull ad data automatically. This step is optional — you can always connect later from Settings.
          </p>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={onConnect}>Connect Meta</Button>
            <Button size="sm" variant="ghost" onClick={onSkip}>Skip for now</Button>
          </div>
        </>
      )}

      {status === 'connected' && (
        <>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-stone-800">Meta Connected</h3>
          </div>
          <p className="mt-2 text-sm text-stone-600">
            Your Meta account is connected. Ad data will be pulled in automatically.
          </p>
        </>
      )}

      {status === 'skipped' && (
        <>
          <div className="flex items-center gap-2">
            <SkipForward className="size-4 text-stone-400" />
            <h3 className="text-sm font-semibold text-stone-800">Meta Skipped</h3>
          </div>
          <p className="mt-2 text-sm text-stone-600">
            No worries — you can connect your Meta account later from Settings whenever you are ready.
          </p>
          <Button size="sm" variant="outline" className="mt-4" onClick={onConnect}>
            Connect Meta
          </Button>
        </>
      )}

      {status === 'failed' && (
        <>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-red-500" />
            <h3 className="text-sm font-semibold text-stone-800">Connection Failed</h3>
          </div>
          <p className="mt-2 text-sm text-stone-600">
            Something went wrong connecting to Meta. You can retry or skip and try again later.
          </p>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={onRetry}>Retry</Button>
            <Button size="sm" variant="ghost" onClick={onSkip}>Skip for now</Button>
          </div>
        </>
      )}
    </div>
  );
}
