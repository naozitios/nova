import type { ReactNode } from 'react';

type OnboardingActionFooterProps = {
  children: ReactNode;
};

export function OnboardingActionFooter({ children }: OnboardingActionFooterProps) {
  return (
    <div className="sticky bottom-0 z-20 border-t border-[#ead8d3] bg-[#fbf6f4]/95 px-4 py-4 shadow-[0_-4px_16px_rgba(234,216,211,0.35)] backdrop-blur-xl md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {children}
      </div>
    </div>
  );
}
