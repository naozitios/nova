import { CheckCircle2, Globe } from 'lucide-react';
import type { MockOnboardingState } from '@/lib/onboarding/types';

type SidebarContextPanelProps = {
  state: MockOnboardingState;
  variant?: 'default' | 'meta' | 'active-sources';
};

export function SidebarContextPanel({ state, variant = 'default' }: SidebarContextPanelProps) {
  const renderActiveSources = () => {
    const websiteSource = state.sources.find((s) => s.sourceType === 'website');
    const uploadedSources = state.sources.filter((s) => s.sourceType === 'upload');

    const statusLabel = (status: string) => {
      if (status === 'complete') return 'Ready';
      if (status === 'processing') return 'Analysing...';
      if (status === 'failed') return 'Failed';
      if (status === 'uploading') return 'Uploading...';
      return 'Queued';
    };

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-4">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-primary uppercase tracking-wider font-semibold">
            Active Sources
          </span>
          <CheckCircle2 className="size-4 text-success" />
        </div>
        <div className="space-y-4">
          {websiteSource && (
            <div className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <Globe className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {websiteSource.externalReference || 'Website'}
                </p>
                <p className="text-xs text-muted-foreground">{statusLabel(websiteSource.status)}</p>
              </div>
            </div>
          )}
          {uploadedSources.map((source) => (
            <div key={source.id} className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <svg className="size-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{source.sourceName}</p>
                <p className="text-xs text-muted-foreground">{statusLabel(source.status)}</p>
              </div>
            </div>
          ))}
          {uploadedSources.length === 0 && !websiteSource && (
            <p className="text-sm text-muted-foreground">No sources added yet</p>
          )}
        </div>
      </div>
    );
  };

  const renderMetaStatus = () => {
    const { status } = state.metaConnection;
    const hasAccount = state.selectedAdAccountId !== null;

    const getStatusInfo = () => {
      if (status === 'connected' && hasAccount) {
        return { label: 'Connected', variant: 'success' as const, sub: 'Connected' };
      }
      if (status === 'connected' && !hasAccount) {
        return { label: 'Pending Ad Account', variant: 'pending' as const, sub: 'Pending Ad Account' };
      }
      if (status === 'skipped') {
        return { label: 'Skipped', variant: 'muted' as const, sub: 'Skipped' };
      }
      if (status === 'failed') {
        return { label: 'Failed', variant: 'error' as const, sub: 'Failed' };
      }
      return { label: 'Pending', variant: 'pending' as const, sub: 'Not connected' };
    };

    const statusInfo = getStatusInfo();

    return (
      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <svg className="size-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Meta Ads</p>
              <p className="text-xs text-muted-foreground">{statusInfo.sub}</p>
            </div>
          </div>
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
              statusInfo.variant === 'success'
                ? 'bg-green-100 text-green-700'
                : statusInfo.variant === 'error'
                ? 'bg-red-100 text-red-700'
                : 'bg-secondary text-muted-foreground'
            }`}
          >
            {statusInfo.label}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Active Sources Card - same as step 2 */}
      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        {renderActiveSources()}
      </div>

      {/* Meta Status Card - for step 3 */}
      {variant === 'meta' && renderMetaStatus()}

      {/* AI Tip */}
      <div className="flex items-center gap-2 rounded-2xl bg-secondary p-4">
        <span className="text-primary">✨</span>
        <p className="text-sm text-muted-foreground">
          Multi-source learning increases ad conversion accuracy by up to 34%.
        </p>
      </div>
    </div>
  );
}
