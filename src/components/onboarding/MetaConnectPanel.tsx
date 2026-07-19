'use client';

import type { MetaConnectionStatus, MockAdAccount } from '@/lib/onboarding/types';
import {
  Wallet,
  Megaphone,
  Image,
  TrendingUp,
  Activity,
  Info,
  CheckCircle2,
  SkipForward,
  AlertTriangle,
  Building2,
  DollarSign,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type MetaConnectPanelProps = {
  status: MetaConnectionStatus;
  adAccounts?: MockAdAccount[];
  selectedAccountId?: string | null;
  onSelectAccount?: (accountId: string) => void;
  onRefresh?: () => void;
  onConnect?: () => void;
  onSkip?: () => void;
};

const accessPermissions: Array<{
  icon: typeof Wallet;
  label: string;
  description: string;
  color: string;
  span?: number;
}> = [
  {
    icon: Wallet,
    label: 'Ad accounts',
    description: 'Structure and billing status',
    color: 'text-amber-500',
  },
  {
    icon: Megaphone,
    label: 'Campaigns',
    description: 'Current settings and goals',
    color: 'text-primary',
  },
  {
    icon: Image,
    label: 'Creatives',
    description: 'Visual assets and copy',
    color: 'text-purple-500',
  },
  {
    icon: TrendingUp,
    label: 'Performance data',
    description: 'Impressions, clicks, and ROAS',
    color: 'text-success',
  },
  {
    icon: Activity,
    label: 'Pixel health',
    description: 'Event firing accuracy and tracking diagnostics',
    color: 'text-blue-500',
    span: 2,
  },
];

export function MetaConnectPanel({
  status,
  adAccounts = [],
  selectedAccountId,
  onSelectAccount,
  onRefresh,
  onConnect,
  onSkip,
}: MetaConnectPanelProps) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
      {/* Not connected: show permissions grid + connect button */}
      {status === 'not_connected' && (
        <>
          <h3 className="mb-6 text-xl font-semibold text-foreground">
            Information NOVA will access:
          </h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {accessPermissions.map((perm) => (
              <div
                key={perm.label}
                className={`flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm ${
                  perm.span === 2 ? 'md:col-span-2' : ''
                }`}
              >
                <perm.icon className={`mt-0.5 size-5 shrink-0 ${perm.color}`} />
                <div>
                  <p className="text-sm font-semibold text-foreground">{perm.label}</p>
                  <p className="text-sm text-muted-foreground">{perm.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-3 rounded-2xl bg-secondary p-4">
            <Info className="size-5 shrink-0 text-muted-foreground" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-bold">Approval-Based:</span> NOVA identifies optimizations, but{' '}
              <span className="underline">never</span> pushes changes to your live campaigns without your
              explicit &quot;Approve&quot; click in the workspace.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-4 border-t border-stone-100 pt-6">
            <button
              onClick={() => onConnect?.()}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-10 py-3 text-base font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95"
            >
              <span>Connect Meta</span>
            </button>
            <button
              onClick={() => onSkip?.()}
              className="w-full rounded-full px-8 py-3 text-sm text-muted-foreground transition-colors hover:bg-secondary active:scale-95"
            >
              Do this later
            </button>
          </div>
        </>
      )}

      {/* Connected but no account selected: show ad account selection */}
      {status === 'connected' && !selectedAccountId && (
        <>
          <h3 className="mb-2 text-xl font-semibold text-foreground">
            Select your ad account
          </h3>
          <p className="mb-6 text-sm text-muted-foreground">
            Choose the specific advertising account you want NOVA to manage.
          </p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {adAccounts.map((account) => (
              <button
                key={account.id}
                onClick={() => onSelectAccount?.(account.id)}
                className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-4 text-left shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                  <Building2 className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{account.name}</p>
                  <p className="text-xs text-muted-foreground">ID: {account.id}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5">
                      <DollarSign className="size-3 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">{account.currency}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5">
                      <Clock className="size-3 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">{account.timezone}</span>
                    </span>
                  </div>
                </div>
              </button>
            ))}

            {/* Refresh card */}
            <button
              onClick={() => onRefresh?.()}
              className="flex items-center justify-center rounded-xl border-2 border-dashed border-stone-200 bg-stone-50 p-4 text-center transition-all hover:border-primary/40 hover:bg-white"
            >
              <div className="flex flex-col items-center gap-2">
                <RefreshCw className="size-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Refresh List</p>
                  <p className="text-xs text-muted-foreground">Can&apos;t see your account?</p>
                </div>
              </div>
            </button>
          </div>

          <div className="mt-6 flex items-center gap-3 rounded-2xl bg-secondary p-4">
            <Info className="size-5 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              By selecting an account, you grant NOVA permission to read performance data and suggest optimizations.
            </p>
          </div>
        </>
      )}

      {/* Connected with account selected: show success */}
      {status === 'connected' && selectedAccountId && (
        <div>
          <h3 className="mb-6 text-xl font-semibold text-foreground">
            Information NOVA will access:
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {accessPermissions.map((perm) => (
              <div
                key={perm.label}
                className={`flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm ${
                  perm.span === 2 ? 'md:col-span-2' : ''
                }`}
              >
                <perm.icon className={`mt-0.5 size-5 shrink-0 ${perm.color}`} />
                <div>
                  <p className="text-sm font-semibold text-foreground">{perm.label}</p>
                  <p className="text-sm text-muted-foreground">{perm.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-3 rounded-2xl bg-green-50 p-4">
            <CheckCircle2 className="size-5 shrink-0 text-success" />
            <p className="text-sm text-success">
              <span className="font-bold">Connected:</span> NOVA is now syncing your Meta ad data.
            </p>
          </div>
        </div>
      )}

      {status === 'skipped' && (
        <div className="flex flex-col items-center text-center">
          <SkipForward className="mb-4 size-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-muted-foreground">Meta Skipped</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            No worries — you can connect your Meta account later from Settings whenever you are ready.
          </p>
        </div>
      )}

      {status === 'failed' && (
        <div className="flex flex-col items-center text-center">
          <AlertTriangle className="mb-4 size-12 text-destructive" />
          <h3 className="text-lg font-semibold text-destructive">Connection Failed</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Something went wrong connecting to Meta. You can retry or skip and try again later.
          </p>
          <div className="mt-6 flex gap-4">
            <button
              onClick={() => onConnect?.()}
              className="rounded-full bg-primary px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-primary/90 active:scale-95"
            >
              Retry
            </button>
            <button
              onClick={() => onSkip?.()}
              className="rounded-full px-8 py-3 text-sm text-muted-foreground transition-colors hover:bg-secondary active:scale-95"
            >
              Skip for now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
