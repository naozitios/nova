import type { ReactNode } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getStepByIndex } from '@/lib/onboarding/flow';
import { OnboardingProgress } from './OnboardingProgress';

type OnboardingShellProps = {
  currentIndex: number;
  children: ReactNode;
  footer: ReactNode;
  onBack: () => void;
  canGoBack: boolean;
  layout?: 'sidebar' | 'centered';
  sidebar?: ReactNode;
  skippedStepKeys?: string[];
};

export function OnboardingShell({
  currentIndex,
  children,
  footer,
  onBack,
  canGoBack,
  layout = 'sidebar',
  sidebar,
  skippedStepKeys = [],
}: OnboardingShellProps) {
  const step = getStepByIndex(currentIndex);

  return (
    <main className="onboarding-warm min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 px-4 py-4 backdrop-blur-xl md:px-8">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          {canGoBack && (
            <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Go back">
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <Link href="/dashboard" className="text-lg font-semibold tracking-[-0.03em] text-foreground">
            NOVA
          </Link>
          <div className="ml-auto">
            <Button asChild variant="ghost" size="icon" aria-label="Exit onboarding">
              <Link href="/dashboard">
                <X className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
        <OnboardingProgress currentIndex={currentIndex} skippedStepKeys={skippedStepKeys} />

        {layout === 'sidebar' ? (
          <div className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {step.eyebrow}
              </p>
              <h1 className="max-w-xl text-4xl font-semibold tracking-[-0.06em] text-foreground md:text-5xl lg:text-6xl">
                {step.title}
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground md:text-lg">
                {step.description}
              </p>
              {sidebar && <div className="mt-8">{sidebar}</div>}
            </aside>
            <div>{children}</div>
          </div>
        ) : (
          <div className="mt-10">
            <div className="mx-auto max-w-3xl text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {step.eyebrow}
              </p>
              <h1 className="text-4xl font-semibold tracking-[-0.06em] text-foreground md:text-5xl">
                {step.title}
              </h1>
              <p className="mt-5 text-base leading-7 text-muted-foreground md:text-lg">
                {step.description}
              </p>
            </div>
            <div className="mt-10">{children}</div>
          </div>
        )}
      </div>

      {footer}
    </main>
  );
}
