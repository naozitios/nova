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
  skippedStepKeys?: string[];
};

export function OnboardingShell({ currentIndex, children, footer, onBack, canGoBack, skippedStepKeys = [] }: OnboardingShellProps) {
  const step = getStepByIndex(currentIndex);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fbf6f4] text-[#251816]">
      <header className="border-b border-[#ead8d3] bg-[#fbf6f4]/95 px-4 py-4 backdrop-blur-xl md:px-8">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <Button type="button" variant="ghost" size="icon" onClick={onBack} disabled={!canGoBack} aria-label="Go back">
            <ArrowLeft className="size-4" />
          </Button>
          <Link href="/dashboard" className="text-lg font-semibold tracking-[-0.03em] text-[#251816]">
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
        <div className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#8d716b]">{step.eyebrow}</p>
            <h1 className="max-w-xl text-4xl font-semibold tracking-[-0.06em] text-[#251816] md:text-5xl lg:text-6xl">{step.title}</h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#645d58] md:text-lg">{step.description}</p>
          </aside>
          <div>{children}</div>
        </div>
      </div>
      {footer}
    </main>
  );
}
