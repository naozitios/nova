import { AlertCircle } from 'lucide-react';
import { OnboardingCard } from './OnboardingCard';
import type { MockCompiledProfile, MockQuestion } from '@/lib/onboarding/types';

type BusinessContextReviewProps = {
  profile: MockCompiledProfile;
  questions: MockQuestion[];
  canApprove: boolean;
};

export function BusinessContextReview({ profile, questions, canApprove }: BusinessContextReviewProps) {
  return (
    <div className="grid gap-6">
      <OnboardingCard>
        <p className="mb-6 text-sm leading-6 text-[#645d58]">{profile.summary}</p>

        <div className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#8d716b]">Offerings</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-[#251816]">
            {profile.offerings.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#8d716b]">Value Propositions</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-[#251816]">
            {profile.valuePropositions.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#8d716b]">Target Audiences</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-[#251816]">
            {profile.targetAudiences.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[#ead8d3] bg-[#fbf6f4] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8d716b]">Funnel Goal</p>
            <p className="mt-1 text-sm font-medium text-[#251816]">{profile.funnelGoal}</p>
          </div>
          <div className="rounded-xl border border-[#ead8d3] bg-[#fbf6f4] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8d716b]">Target CPA</p>
            <p className="mt-1 text-sm font-medium text-[#251816]">{profile.targetCpa}</p>
          </div>
        </div>
      </OnboardingCard>

      {questions.length > 0 && (
        <OnboardingCard>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-[#8d716b]">Clarifying Questions</h3>
          <div className="grid gap-4">
            {questions.map((q) => (
              <div key={q.factKey} className="rounded-xl border border-[#ead8d3] bg-[#fbf6f4] px-4 py-3">
                <p className="text-sm font-medium text-[#251816]">{q.question}</p>
                {q.answer && (
                  <p className="mt-2 text-sm text-[#645d58]">
                    {Array.isArray(q.answer) ? q.answer.join(', ') : q.answer}
                  </p>
                )}
              </div>
            ))}
          </div>
        </OnboardingCard>
      )}

      {!canApprove && (
        <div className="flex items-start gap-3 rounded-xl border border-[#ead8d3] bg-[#fbf6f4] px-4 py-3 text-sm text-[#645d58]">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-[#8d716b]" />
          Workspace admin approval is required before NOVA uses this context.
        </div>
      )}
    </div>
  );
}
