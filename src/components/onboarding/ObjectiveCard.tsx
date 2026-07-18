import type { MockObjective } from '@/lib/onboarding/types';
import { cn } from '@/lib/utils';

type ObjectiveCardProps = {
  objective: MockObjective;
  selected: boolean;
  onSelect: () => void;
};

export function ObjectiveCard({ objective, selected, onSelect }: ObjectiveCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-[1.5rem] border bg-white/85 p-6 text-left shadow-sm shadow-[#ead8d3]/40 transition-all',
        selected
          ? 'border-[#aa3016] shadow-[#aa3016]/10 ring-1 ring-[#aa3016]/20 bg-[#aa3016]/5'
          : 'border-[#ead8d3] hover:border-[#d14a2e] hover:bg-[#aa3016]/[0.03]'
      )}
    >
      <p className="text-sm font-semibold text-[#251816]">{objective.title}</p>
      <p className="mt-1 text-sm text-[#645d58]">{objective.description}</p>
    </button>
  );
}
