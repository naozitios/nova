import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type OnboardingActionFooterProps = {
  children: ReactNode;
  variant?: 'sticky' | 'inline' | 'fixed';
};

export function OnboardingActionFooter({ children, variant = 'sticky' }: OnboardingActionFooterProps) {
  return (
    <div
      className={cn(
        'border-t border-border px-4 py-4 md:px-8',
        variant === 'sticky' && 'sticky bottom-0 z-20 bg-background/95 shadow-[0_-4px_16px_rgba(0,0,0,0.05)] backdrop-blur-xl',
        variant === 'fixed' && 'fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl',
        variant === 'inline' && 'bg-transparent'
      )}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {children}
      </div>
    </div>
  );
}
