import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type OnboardingCardProps = {
  children: ReactNode;
  className?: string;
};

export function OnboardingCard({ children, className }: OnboardingCardProps) {
  return (
    <section
      className={cn(
        'rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8',
        className
      )}
    >
      {children}
    </section>
  );
}
