import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { OnboardingCard } from './OnboardingCard';
import { SourceStatusCard } from './SourceStatusCard';
import type { MockProcessingState } from '@/lib/onboarding/types';

type ProcessingTimelineProps = {
  processing: MockProcessingState;
};

export function ProcessingTimeline({ processing }: ProcessingTimelineProps) {
  return (
    <OnboardingCard>
      <p className="mb-6 text-sm leading-6 text-[#645d58]">{processing.currentMessage}</p>

      {processing.sources.length > 0 && (
        <div className="mb-6 grid gap-3">
          {processing.sources.map((source) => (
            <SourceStatusCard key={source.id} source={source} />
          ))}
        </div>
      )}

      {processing.blockers.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-800">
            <AlertTriangle className="size-4" />
            Blockers
          </div>
          <ul className="list-inside list-disc space-y-1 text-sm text-amber-700">
            {processing.blockers.map((blocker, i) => (
              <li key={i}>{blocker}</li>
            ))}
          </ul>
        </div>
      )}

      {processing.canContinue && (
        <div className="flex items-center gap-2 rounded-xl border border-[#ead8d3] bg-[#fbf6f4] px-4 py-3 text-sm font-medium text-[#aa3016]">
          <CheckCircle2 className="size-4" />
          Ready to continue
        </div>
      )}
    </OnboardingCard>
  );
}
