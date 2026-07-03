'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { DashboardInsight, DashboardInsightSeverity } from './dashboard-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface DashboardInsightCardProps {
  insight: DashboardInsight;
  onReview: (insight: DashboardInsight) => void;
  onDismiss: (id: string) => void;
}

const SEVERITY_STYLES: Record<DashboardInsightSeverity, string> = {
  Critical: 'border-red-200 bg-red-50 text-red-700',
  Warning: 'border-amber-200 bg-amber-50 text-amber-700',
  Opportunity: 'border-green-200 bg-green-50 text-green-700',
  Informational: 'border-blue-200 bg-blue-50 text-blue-700',
};

export function DashboardInsightCard({ insight, onReview, onDismiss }: DashboardInsightCardProps) {
  return (
    <article className="rounded-3xl border border-stone-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-stone-200 bg-stone-50 text-stone-600">
          {insight.category}
        </Badge>
        <Badge variant="outline" className={SEVERITY_STYLES[insight.severity]}>
          {insight.severity}
        </Badge>
      </div>

      <h3 className="text-base font-semibold text-stone-900">{insight.title}</h3>
      <p className="mt-1 text-sm text-stone-500">Affected: {insight.affectedObject}</p>
      <p className="mt-4 text-sm text-stone-700">{insight.whatHappened}</p>
      <div className="mt-4 rounded-2xl bg-stone-50 p-3 text-sm text-stone-600">
        <span className="font-medium text-stone-900">Evidence:</span> {insight.evidence}
      </div>
      <p className="mt-4 text-sm text-stone-600">Next step: {insight.nextStep}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {insight.campaignId ? (
          <Button asChild size="sm" className="rounded-full bg-[#E55A3C] hover:bg-[#D14A2E]">
            <Link href={`/campaigns/${insight.campaignId}`}>
              Deep Dive <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : null}
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => onReview(insight)}>
          Review
        </Button>
        <Button variant="ghost" size="sm" className="rounded-full text-stone-500" onClick={() => onDismiss(insight.id)}>
          Dismiss
        </Button>
      </div>
    </article>
  );
}
