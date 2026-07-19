import type { MetaConnectionStatus } from '@/lib/onboarding/types';
import { OnboardingCard } from './OnboardingCard';
import {
  Users,
  Megaphone,
  Image,
  TrendingUp,
  Activity,
  Info,
  CheckCircle2,
  SkipForward,
  AlertTriangle,
} from 'lucide-react';

type MetaConnectPanelProps = {
  status: MetaConnectionStatus;
};

const accessPermissions: Array<{
  icon: typeof Users;
  label: string;
  description: string;
  span?: number;
}> = [
  {
    icon: Users,
    label: 'Ad Accounts',
    description: 'View and manage your ad accounts',
  },
  {
    icon: Megaphone,
    label: 'Campaigns',
    description: 'Access campaign data and performance',
  },
  {
    icon: Image,
    label: 'Creatives',
    description: 'View ad creatives and assets',
  },
  {
    icon: TrendingUp,
    label: 'Performance Data',
    description: 'Track metrics and reporting',
  },
  {
    icon: Activity,
    label: 'Pixel Health',
    description: 'Monitor pixel events and diagnostics',
    span: 2,
  },
];

export function MetaConnectPanel({ status }: MetaConnectPanelProps) {
  return (
    <OnboardingCard>
      {status === 'not_connected' && (
        <>
          <h3 className="text-base font-semibold text-foreground">
            Connect Meta
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Grant access to pull ad data automatically. This step is optional — you can connect later from Settings.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {accessPermissions.map((perm) => (
              <div
                key={perm.label}
                className={
                  perm.span === 2
                    ? 'col-span-2 flex items-center gap-3 rounded-xl border border-border bg-primary/5 px-4 py-3'
                    : 'flex items-center gap-3 rounded-xl border border-border bg-primary/5 px-4 py-3'
                }
              >
                <perm.icon className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {perm.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {perm.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Approval-Based
              </p>
              <p className="text-xs text-muted-foreground">
                Meta reviews all connection requests. Approval typically takes a few minutes but may take up to 48 hours.
              </p>
            </div>
          </div>
        </>
      )}

      {status === 'connected' && (
        <>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-success" />
            <h3 className="text-sm font-semibold text-success">
              Meta Connected
            </h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Your Meta account is connected. Ad data will be pulled in automatically.
          </p>
        </>
      )}

      {status === 'skipped' && (
        <>
          <div className="flex items-center gap-2">
            <SkipForward className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-muted-foreground">
              Meta Skipped
            </h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            No worries — you can connect your Meta account later from Settings whenever you are ready.
          </p>
        </>
      )}

      {status === 'failed' && (
        <>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            <h3 className="text-sm font-semibold text-destructive">
              Connection Failed
            </h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Something went wrong connecting to Meta. You can retry or skip and try again later.
          </p>
        </>
      )}
    </OnboardingCard>
  );
}
