import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, FileText, Globe, Upload, Link2, AlertTriangle, SkipForward } from 'lucide-react';
import type { MockOnboardingState, MetaConnectionStatus } from '@/lib/onboarding/types';

type SidebarContextPanelProps = {
  state: MockOnboardingState;
  variant?: 'default' | 'meta';
};

export function SidebarContextPanel({ state, variant = 'default' }: SidebarContextPanelProps) {
  const selectedObjective = state.objectiveOptions.find(
    (o) => o.id === state.selectedObjective,
  );

  const renderMetaStatus = (status: MetaConnectionStatus) => {
    if (status === 'connected') {
      return (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-success" />
          <span className="font-medium text-foreground">Meta Connected</span>
        </div>
      );
    }
    if (status === 'skipped') {
      return (
        <div className="flex items-center gap-2">
          <SkipForward className="size-4 text-muted-foreground" />
          <span className="font-medium text-foreground">Meta Skipped</span>
        </div>
      );
    }
    if (status === 'failed') {
      return (
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-destructive" />
          <span className="font-medium text-foreground">Connection Failed</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <Link2 className="size-4 text-muted-foreground" />
        <span className="font-medium text-foreground">Meta Ads</span>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Not connected</span>
      </div>
    );
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-foreground">Current context</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {variant === 'meta' ? (
          renderMetaStatus(state.metaConnection.status)
        ) : (
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <span className="font-medium text-foreground">Objective</span>
              <p className="text-muted-foreground">
                {selectedObjective?.title ?? 'Not selected'}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2">
          <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <span className="font-medium text-foreground">
              {state.sources.length} source{state.sources.length !== 1 ? 's' : ''}
            </span>
            <p className="text-muted-foreground">
              {state.sources
                .map((s) => s.sourceName)
                .join(', ') || 'None yet'}
            </p>
          </div>
        </div>

        {state.manualNotes && (
          <div className="flex items-start gap-2">
            <Upload className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <span className="font-medium text-foreground">Manual notes</span>
              <p className="line-clamp-2 text-muted-foreground">{state.manualNotes}</p>
            </div>
          </div>
        )}

        {state.business.websiteUrl && (
          <div className="flex items-start gap-2">
            <Globe className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <span className="font-medium text-foreground">Website</span>
              <p className="text-muted-foreground">{state.business.websiteUrl}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
