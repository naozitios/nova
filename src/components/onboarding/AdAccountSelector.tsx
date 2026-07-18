import type { MockAdAccount, MetaConnectionStatus } from '@/lib/onboarding/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { OnboardingCard } from './OnboardingCard';

type AdAccountSelectorProps = {
  metaStatus: MetaConnectionStatus;
  accounts: MockAdAccount[];
  selectedAdAccountId: string | null;
  onSelect: (accountId: string) => void;
  onRefresh: () => void;
  onRetryMeta: () => void;
};

export function AdAccountSelector({
  metaStatus,
  accounts,
  selectedAdAccountId,
  onSelect,
  onRefresh,
  onRetryMeta,
}: AdAccountSelectorProps) {
  if (metaStatus === 'skipped') {
    return (
      <OnboardingCard className="text-center">
        <p className="text-sm text-[#645d58]">
          Meta connection was skipped. You can connect later from settings.
        </p>
      </OnboardingCard>
    );
  }

  if (metaStatus === 'failed') {
    return (
      <OnboardingCard className="text-center">
        <p className="mb-4 text-sm text-[#645d58]">
          Meta connection failed. Please try again.
        </p>
        <Button variant="outline" size="sm" onClick={onRetryMeta}>
          Retry Meta Connection
        </Button>
      </OnboardingCard>
    );
  }

  if (accounts.length === 0) {
    return (
      <OnboardingCard className="text-center">
        <p className="mb-4 text-sm text-[#645d58]">
          Connected but no ad accounts found.
        </p>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          Refresh Accounts
        </Button>
      </OnboardingCard>
    );
  }

  return (
    <RadioGroup
      value={selectedAdAccountId ?? ''}
      onValueChange={onSelect}
      className="space-y-3"
    >
      {accounts.map((account) => (
        <label
          key={account.id}
          className={cn(
            'flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors',
            selectedAdAccountId === account.id
              ? 'border-[#aa3016] bg-[#fbf6f4]'
              : 'border-[#ead8d3] bg-white/85 hover:border-[#aa3016]/30 hover:bg-[#fbf6f4]'
          )}
        >
          <RadioGroupItem value={account.id} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#251816]">
              {account.name}
            </p>
            <p className="text-xs text-[#645d58]">
              {account.currency} · {account.timezone}
            </p>
          </div>
          <span className="shrink-0 text-xs text-[#8d716b]">{account.status}</span>
        </label>
      ))}
    </RadioGroup>
  );
}
