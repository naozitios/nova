import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type OnboardingCardProps = {
  children: ReactNode;
  className?: string;
};

export function OnboardingCard({ children, className }: OnboardingCardProps) {
  return (
    <section className={cn('rounded-[2rem] border border-[#ead8d3] bg-white/80 p-6 shadow-sm shadow-[#ead8d3]/40 md:p-8', className)}>
      {children}
    </section>
  );
}
