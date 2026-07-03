'use client';

import type { DashboardInsight } from './dashboard-types';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface DashboardInsightDrawerProps {
  insight: DashboardInsight | null;
  onClose: () => void;
}

export function DashboardInsightDrawer({ insight, onClose }: DashboardInsightDrawerProps) {
  if (!insight) return null;

  return (
    <Sheet open={Boolean(insight)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b border-stone-100 pb-4">
          <SheetTitle className="text-stone-900">{insight.title}</SheetTitle>
          <SheetDescription>{insight.affectedObject}</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-6 pb-6 text-sm text-stone-600">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">What happened</h3>
            <p>{insight.whatHappened}</p>
          </section>
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Why it matters</h3>
            <p>{insight.whyItMatters}</p>
          </section>
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Evidence</h3>
            <p>{insight.evidence}</p>
          </section>
          <section className="rounded-2xl bg-stone-50 p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Recommended next step</h3>
            <p className="font-medium text-stone-800">{insight.nextStep}</p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
