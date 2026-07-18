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
        'w-full rounded-[1.5rem] border bg-white/85 p-6 text-left shadow-sm shadow-stone-200/60 transition-all hover:shadow-md',
        selected
          ? 'border-[#aa3016] ring-1 ring-[#aa3016]/20'
          : 'border-[#ead8d3] hover:border-[#d4b8af]'
      )}
    >
      <p className="text-sm font-semibold text-stone-800">{objective.title}</p>
      <p className="mt-1 text-sm text-stone-500">{objective.description}</p>
    </button>
  );
}
