import { ArrowLeft, Check, Clock, DollarSign, RefreshCw, Building2 } from 'lucide-react';
import type { MockAdAccount, MetaConnectionStatus } from '@/lib/onboarding/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type AdAccountSelectorProps = {
  metaStatus: MetaConnectionStatus;
  accounts: MockAdAccount[];
  selectedAdAccountId: string | null;
  onSelect: (accountId: string) => void;
  onRefresh: () => void;
  onBack: () => void;
};

export function AdAccountSelector({
  metaStatus,
  accounts,
  selectedAdAccountId,
  onSelect,
  onRefresh,
  onBack,
}: AdAccountSelectorProps) {
  if (metaStatus === 'skipped') {
    return (
      <div className="mx-auto max-w-3xl text-center">
        <p className="mb-4 text-sm text-muted-foreground">
          Meta connection was skipped. You can connect later from settings.
        </p>
      </div>
    );
  }

  if (metaStatus === 'failed') {
    return (
      <div className="mx-auto max-w-3xl text-center">
        <p className="mb-4 text-sm text-muted-foreground">
          Meta connection failed. Please try again.
        </p>
        <Button variant="outline" size="sm">
          Retry Meta Connection
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl w-full">
      {/* Back link */}
      <button
        type="button"
        onClick={onBack}
        className="mb-8 flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground group"
      >
        <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
        <span className="text-sm">Back to Integrations</span>
      </button>

      {/* Header */}
      <div className="mb-10 text-center">
        <h2 className="mb-2 text-3xl font-semibold tracking-[-0.06em] text-foreground">
          Select your ad account
        </h2>
        <p className="text-base text-muted-foreground">
          Choose the specific advertising account you want NOVA to manage and optimize.
        </p>
      </div>

      {/* Account grid */}
      {accounts.length > 0 ? (
        <RadioGroup
          value={selectedAdAccountId ?? ''}
          onValueChange={onSelect}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {accounts.map((account) => {
            const isSelected = selectedAdAccountId === account.id;
            return (
              <label
                key={account.id}
                className={cn(
                  'relative flex h-full cursor-pointer flex-col rounded-3xl border p-6 transition-all',
                  isSelected
                    ? 'border-primary bg-card shadow-sm ring-1 ring-primary'
                    : 'border-border bg-card hover:border-muted-foreground/30'
                )}
              >
                <RadioGroupItem value={account.id} className="sr-only" />
                {/* Top row: icon + check */}
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
                    <Building2 className="size-5 text-muted-foreground" />
                  </div>
                  <div
                    className={cn(
                      'flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground',
                      isSelected ? 'flex' : 'hidden'
                    )}
                  >
                    <Check className="size-4" />
                  </div>
                </div>

                {/* Name + ID */}
                <h3 className="mb-1 text-lg font-semibold text-foreground">
                  {account.name}
                </h3>
                <p className="mb-4 text-xs text-muted-foreground">
                  ID: {account.id}
                </p>

                {/* Badges */}
                <div className="mt-auto flex flex-wrap gap-1.5 border-t border-border pt-4">
                  <div className="flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5">
                    <DollarSign className="size-3 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">{account.currency}</span>
                  </div>
                  <div className="flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5">
                    <Clock className="size-3 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">{account.timezone}</span>
                  </div>
                </div>
              </label>
            );
          })}

          {/* Refresh card */}
          <div className="relative h-full">
            <button
              type="button"
              onClick={onRefresh}
              className="flex h-full w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border bg-muted/30 p-6 text-center transition-all hover:border-primary/40 hover:bg-card group"
            >
              <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-card shadow-sm transition-transform group-hover:scale-110">
                <RefreshCw className="size-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Refresh List</h3>
              <p className="mt-1 max-w-[160px] text-sm text-muted-foreground">
                Can't see your account? Try refreshing or check permissions.
              </p>
            </button>
          </div>
        </RadioGroup>
      ) : (
        <div className="text-center">
          <p className="mb-4 text-sm text-muted-foreground">
            Connected but no ad accounts found.
          </p>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            Refresh Accounts
          </Button>
        </div>
      )}
    </div>
  );
}
