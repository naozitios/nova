import { Check } from 'lucide-react';
import { ONBOARDING_STEPS } from '@/lib/onboarding/flow';
import { cn } from '@/lib/utils';

type OnboardingProgressProps = {
  currentIndex: number;
  skippedStepKeys?: string[];
  blockedStepKeys?: string[];
  variant?: 'bar' | 'dots';
};

export function OnboardingProgress({
  currentIndex,
  skippedStepKeys = [],
  blockedStepKeys = [],
  variant = 'bar',
}: OnboardingProgressProps) {
  if (variant === 'dots') {
    return (
      <div className="flex items-center justify-center gap-1.5" role="progressbar" aria-label="Onboarding progress">
        {ONBOARDING_STEPS.map((step, index) => {
          const complete = index <= currentIndex;
          return (
            <div
              key={step.key}
              className={cn(
                'h-2 rounded-full transition-colors',
                complete ? 'w-8 bg-primary' : 'w-2 bg-border'
              )}
            />
          );
        })}
      </div>
    );
  }

  const percentage = Math.round(((currentIndex + 1) / ONBOARDING_STEPS.length) * 100);

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between text-xs font-medium uppercase tracking-[0.24em] text-primary">
        <span>{ONBOARDING_STEPS[currentIndex]?.eyebrow}</span>
        <span>{percentage}%</span>
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
          const skipped = skippedStepKeys.includes(step.key) && !current;
          const blocked = blockedStepKeys.includes(step.key);

          return (
            <div key={step.key} className="group relative">
              <div
                className={cn(
                  'h-2 rounded-full bg-border transition-colors',
                  complete && 'bg-primary',
                  current && 'bg-primary/70',
                  skipped && 'bg-muted',
                  blocked && 'bg-warning'
                )}
              />
              <div className="mt-2 hidden text-[11px] font-medium text-muted-foreground lg:block">
                {complete && !skipped ? <Check className="mb-1 size-3 text-primary" /> : null}
                <span className={cn(current && 'text-foreground', skipped && 'text-muted-foreground')}>
                  {step.title}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
