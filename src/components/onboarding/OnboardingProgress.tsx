import { Check } from 'lucide-react';
import { ONBOARDING_STEPS } from '@/lib/onboarding/flow';
import { cn } from '@/lib/utils';

type OnboardingProgressProps = {
  currentIndex: number;
  skippedStepKeys?: string[];
  blockedStepKeys?: string[];
};

export function OnboardingProgress({ currentIndex, skippedStepKeys = [], blockedStepKeys = [] }: OnboardingProgressProps) {
  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between text-xs font-medium uppercase tracking-[0.24em] text-[#8d716b]">
        <span>{ONBOARDING_STEPS[currentIndex]?.eyebrow}</span>
        <span>{Math.round(((currentIndex + 1) / ONBOARDING_STEPS.length) * 100)}%</span>
      </div>
      <div
        className="grid gap-1.5"
        role="progressbar"
        aria-label="Onboarding progress"
        aria-valuenow={currentIndex + 1}
        aria-valuemin={1}
        aria-valuemax={ONBOARDING_STEPS.length}
        style={{ gridTemplateColumns: `repeat(${ONBOARDING_STEPS.length}, minmax(0, 1fr))` }}
      >
        {ONBOARDING_STEPS.map((step, index) => {
          const complete = index < currentIndex;
          const current = index === currentIndex;
          const skipped = skippedStepKeys.includes(step.key);
          const blocked = blockedStepKeys.includes(step.key);

          return (
            <div key={step.key} className="group relative">
              <div
                className={cn(
                  'h-2 rounded-full bg-[#ead8d3] transition-colors',
                  complete && 'bg-[#aa3016]',
                  current && 'bg-[#d14a2e]',
                  skipped && 'bg-[#d8ccc8]',
                  blocked && 'bg-[#f59e0b]'
                )}
              />
              <div className="mt-2 hidden text-[11px] font-medium text-[#645d58] lg:block">
                {complete && !skipped ? <Check className="mb-1 size-3 text-[#aa3016]" /> : null}
                <span className={cn(current && 'text-[#251816]', skipped && 'text-[#8d716b]')}>{step.title}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
