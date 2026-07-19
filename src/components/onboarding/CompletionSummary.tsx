import Link from 'next/link';
import { CheckCircle, Building2, ArrowRight, ArrowUpRight } from 'lucide-react';
import type { MockOnboardingState } from '@/lib/onboarding/types';
import { OnboardingCard } from './OnboardingCard';

type CompletionSummaryProps = {
  state: MockOnboardingState;
  completionStatus: 'complete' | 'pending_admin_approval';
};

const NEXT_STEPS = [
  {
    title: 'Import historical data',
    description:
      "We're pulling the last 90 days of performance data to establish your baseline.",
  },
  {
    title: 'First AI Audit',
    description:
      'Our engine scans your campaigns for creative fatigue and efficiency leaks.',
  },
  {
    title: 'Identify Opportunities',
    description:
      'Receive your first 3 tailored recommendations to improve ROAS.',
  },
];

export function CompletionSummary({ state, completionStatus }: CompletionSummaryProps) {
  const { business, metaConnection, selectedAdAccountId, adAccounts, completion } = state;

  const connectedAccountLabel =
    metaConnection.status === 'connected' && selectedAdAccountId
      ? (() => {
          const account = adAccounts.find((a) => a.id === selectedAdAccountId);
          const shortId = selectedAdAccountId.slice(-6);
          return account ? `${account.name}: ID …${shortId}` : `Meta Ads: ID …${shortId}`;
        })()
      : metaConnection.status === 'connected'
        ? 'Meta Ads: Connected'
        : 'Not connected';

  return (
    <div className="mx-auto w-full max-w-3xl">
      <OnboardingCard className="flex flex-col items-center text-center">
        {/* Celebration header */}
        <div className="mb-10 flex flex-col items-center">
          <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-success/10 text-success animate-bounce">
            <CheckCircle className="size-10" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            You&apos;re all set up!
          </h1>
          <p className="mt-2 max-w-lg text-base text-muted-foreground">
            Your business context is mapped and your Meta Ad account is
            successfully connected to NOVA AI.
          </p>
        </div>

        {/* Connection Summary */}
        <OnboardingCard className="mb-10 w-full bg-muted/50 text-left">
          <h3 className="mb-4 text-center text-xl font-semibold text-foreground">
            Connection Summary
          </h3>
          <div className="mx-auto grid max-w-xl grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card shadow-sm">
                <Building2 className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Business Profile</p>
                <p className="text-sm font-semibold text-foreground">{business.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card shadow-sm">
                <ArrowUpRight className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Connected Account</p>
                <p className="text-sm font-semibold text-foreground">
                  {connectedAccountLabel}
                </p>
              </div>
            </div>
          </div>
        </OnboardingCard>

        {/* What happens next */}
        <div className="mb-10 w-full">
          <h3 className="mb-6 text-center text-xl font-semibold text-foreground">
            What happens next?
          </h3>
          <div className="mx-auto max-w-xl space-y-4">
            {NEXT_STEPS.map((step, i) => (
              <div
                key={step.title}
                className="group flex gap-4 rounded-xl border border-transparent p-4 transition-colors hover:border-border hover:bg-muted/30"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {i + 1}
                </div>
                <div>
                  <h4 className="mb-1 text-sm font-bold text-foreground">
                    {step.title}
                  </h4>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Primary CTA */}
        <div className="w-full">
          <Link
            href={completion.dashboardHref}
            className="flex w-full max-w-md mx-auto items-center justify-center gap-2 rounded-full bg-primary py-4 text-lg font-semibold text-primary-foreground shadow-md transition-all hover:opacity-90 active:scale-[0.98]"
          >
            Go to dashboard
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </OnboardingCard>
    </div>
  );
}
