import Link from 'next/link';
import type { MockOnboardingState } from '@/lib/onboarding/types';
import { Button } from '@/components/ui/button';
import { OnboardingCard } from './OnboardingCard';

type CompletionSummaryProps = {
  state: MockOnboardingState;
  completionStatus: 'complete' | 'pending_admin_approval';
};

const metaStatusLabel: Record<string, string> = {
  not_connected: 'Not Connected',
  connected: 'Connected',
  skipped: 'Skipped',
  failed: 'Failed',
};

export function CompletionSummary({ state, completionStatus }: CompletionSummaryProps) {
  const { business, sources, metaConnection, completion } = state;
  const isAdmin = completionStatus === 'complete';

  return (
    <OnboardingCard className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-[#251816]">{business.name}</h3>
        <p className="text-sm text-[#645d58]">Business onboarding complete</p>
      </div>

      <div className="grid gap-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-[#645d58]">Sources</span>
          <span className="font-medium text-[#251816]">{sources.length} added</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#645d58]">Meta</span>
          <span className="font-medium text-[#251816]">
            {metaStatusLabel[metaConnection.status] ?? metaConnection.status}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#645d58]">Approval</span>
          <span className="font-medium text-[#251816]">
            {isAdmin ? 'Approved by admin' : 'Pending admin approval'}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button className="bg-[#aa3016] text-white hover:bg-[#d14a2e]" asChild>
          <Link href={completion.dashboardHref}>Go to Dashboard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={completion.settingsHref}>Open Settings</Link>
        </Button>
      </div>
    </OnboardingCard>
  );
}
