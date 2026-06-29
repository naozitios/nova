'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, TrendingUp, TrendingDown, DollarSign, RefreshCw, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { OptimizationRecommendation, OpportunityType, ConfidenceLevel, RecommendationStatus } from '@/types/optimization';

const mockRecommendations: OptimizationRecommendation[] = [
  {
    id: 'rec1', type: 'creative_fatigue', campaignName: 'Summer Collection Launch',
    finding: 'CPA increased 34% over the last 7 days',
    evidence: 'CTR decreased from 2.3% to 1.4%, frequency increased from 2.1 to 3.8',
    likelyCause: 'Creative fatigue — same audience seeing same creatives too often',
    recommendedAction: 'Reduce budget by 20% and rotate in fresh creative variants',
    expectedImpact: 'Estimated CPA reduction of 18%',
    confidence: 'high', status: 'new', createdAt: '2026-06-28T10:00:00Z',
  },
  {
    id: 'rec2', type: 'scaling', campaignName: 'PMax - Evergreen',
    finding: 'CPA 28% below target with stable ROAS',
    evidence: 'Consistent 3.2x ROAS over 14 days with CPA of $12.50 vs target of $17.00',
    likelyCause: 'Campaign is underinvested relative to available converting audience',
    recommendedAction: 'Increase daily budget by 25% from $267 to $334',
    expectedImpact: 'Estimated 20-30% increase in conversions at similar CPA',
    confidence: 'high', status: 'new', createdAt: '2026-06-28T09:30:00Z',
  },
  {
    id: 'rec3', type: 'budget_waste', campaignName: 'Retargeting - Abandoned Cart',
    finding: 'High spend with declining conversion rate',
    evidence: 'Spend increased 40% MoM but conversion rate dropped from 4.2% to 2.8%',
    likelyCause: 'Audience saturation — most abandoners have already been reached',
    recommendedAction: 'Reduce budget by 30% and refresh audience segmentation',
    expectedImpact: 'Estimated 15% improvement in blended ROAS',
    confidence: 'medium', status: 'new', createdAt: '2026-06-28T08:00:00Z',
  },
  {
    id: 'rec4', type: 'performance_decline', campaignName: 'Holiday Flash Sale',
    finding: 'ROAS declined 45% in the last 3 days',
    evidence: 'Spend remained flat but revenue dropped from $1,200/day to $660/day',
    likelyCause: 'Landing page issues or audience fatigue',
    recommendedAction: 'Investigate landing page performance and check for technical issues',
    expectedImpact: 'Identify root cause before further budget allocation',
    confidence: 'low', status: 'reviewed', createdAt: '2026-06-27T14:00:00Z',
  },
  {
    id: 'rec5', type: 'creative_fatigue', campaignName: 'Brand Awareness Q3',
    finding: 'CPM increased 22% with declining engagement',
    evidence: 'CPM rose from $8.50 to $10.37, CTR dropped from 0.8% to 0.5%',
    likelyCause: 'Ad fatigue among target audience',
    recommendedAction: 'Refresh ad creatives and test new messaging angles',
    expectedImpact: 'Estimated CPM reduction of 15-20%',
    confidence: 'medium', status: 'approved', createdAt: '2026-06-26T11:00:00Z',
  },
  {
    id: 'rec6', type: 'scaling', campaignName: 'Summer Collection Launch',
    finding: 'Strong performance with room to scale',
    evidence: '2.8x ROAS maintained for 10+ days with frequency at 2.1',
    likelyCause: 'Campaign has capacity for additional budget',
    recommendedAction: 'Increase budget cap from $5,000 to $6,500',
    expectedImpact: 'Estimated 25% increase in conversions',
    confidence: 'high', status: 'executed', createdAt: '2026-06-25T09:00:00Z',
  },
];

const typeLabels: Record<OpportunityType, string> = {
  creative_fatigue: 'Creative Fatigue',
  scaling: 'Scaling Opportunity',
  budget_waste: 'Budget Waste',
  performance_decline: 'Performance Decline',
};

const typeIcons: Record<OpportunityType, React.ElementType> = {
  creative_fatigue: RefreshCw,
  scaling: TrendingUp,
  budget_waste: DollarSign,
  performance_decline: TrendingDown,
};

const typeColors: Record<OpportunityType, string> = {
  creative_fatigue: 'bg-purple-50 border-purple-200 text-purple-700',
  scaling: 'bg-green-50 border-green-200 text-green-700',
  budget_waste: 'bg-red-50 border-red-200 text-red-700',
  performance_decline: 'bg-amber-50 border-amber-200 text-amber-700',
};

const confidenceBadge: Record<ConfidenceLevel, string> = {
  high: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-stone-100 text-stone-500',
};

const statusBadge: Record<RecommendationStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  reviewed: 'bg-stone-100 text-stone-600',
  approved: 'bg-green-100 text-green-700',
  dismissed: 'bg-red-100 text-red-700',
  executed: 'bg-stone-900 text-white',
};

type TimeWindow = 'today' | 'yesterday' | '7d' | '30d';

const timeWindows: { label: string; value: TimeWindow }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
];

export default function OptimizationCopilot() {
  const [typeFilter, setTypeFilter] = useState<OpportunityType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<RecommendationStatus | 'all'>('all');
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('7d');

  const filtered = useMemo(() => {
    return mockRecommendations.filter(r => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      return true;
    });
  }, [typeFilter, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100">
          <div className="text-xs text-stone-500 mb-1">Active Recommendations</div>
          <div className="text-2xl font-bold text-stone-900">{mockRecommendations.filter(r => r.status === 'new' || r.status === 'reviewed' || r.status === 'approved').length}</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100">
          <div className="text-xs text-stone-500 mb-1">Creative Fatigue</div>
          <div className="text-2xl font-bold text-stone-900">{mockRecommendations.filter(r => r.type === 'creative_fatigue' && r.status !== 'dismissed').length}</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100">
          <div className="text-xs text-stone-500 mb-1">Scaling Opportunities</div>
          <div className="text-2xl font-bold text-stone-900">{mockRecommendations.filter(r => r.type === 'scaling' && r.status !== 'dismissed').length}</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100">
          <div className="text-xs text-stone-500 mb-1">High Confidence</div>
          <div className="text-2xl font-bold text-stone-900">{mockRecommendations.filter(r => r.confidence === 'high' && r.status !== 'dismissed').length}</div>
        </motion.div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 flex-wrap">
        <div className="flex gap-2">
          {(['all', 'creative_fatigue', 'scaling', 'budget_waste', 'performance_decline'] as const).map(t => (
            <Button key={t} variant={typeFilter === t ? 'default' : 'outline'} size="sm" onClick={() => setTypeFilter(t)} className={typeFilter === t ? 'bg-stone-900 text-white rounded-full' : 'rounded-full'}>
              {t === 'all' ? 'All Types' : typeLabels[t]}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          {(['all', 'new', 'reviewed', 'approved', 'dismissed', 'executed'] as const).map(s => (
            <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s)} className={statusFilter === s ? 'bg-stone-900 text-white rounded-full' : 'rounded-full'}>
              {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          {timeWindows.map(tw => (
            <Button key={tw.value} variant={timeWindow === tw.value ? 'default' : 'outline'} size="sm" onClick={() => setTimeWindow(tw.value)} className={timeWindow === tw.value ? 'bg-stone-900 text-white rounded-full' : 'rounded-full'}>
              {tw.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <Lightbulb className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-600 font-medium">No recommendations found</p>
            <p className="text-stone-400 text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          filtered.map((rec, i) => {
            const Icon = typeIcons[rec.type];
            return (
              <motion.div key={rec.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className={`rounded-2xl p-5 border ${typeColors[rec.type]}`}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge className={statusBadge[rec.status]}>{rec.status.charAt(0).toUpperCase() + rec.status.slice(1)}</Badge>
                      <Badge variant="outline">{rec.campaignName}</Badge>
                      <Badge className={confidenceBadge[rec.confidence]}>{rec.confidence.charAt(0).toUpperCase() + rec.confidence.slice(1)} Confidence</Badge>
                      <span className="text-xs text-stone-400 flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(rec.createdAt).toLocaleDateString()}</span>
                    </div>
                    <h4 className="font-semibold text-stone-900 mb-2">{rec.finding}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-stone-500">Evidence:</span>
                        <p className="text-stone-700 mt-0.5">{rec.evidence}</p>
                      </div>
                      <div>
                        <span className="text-stone-500">Likely Cause:</span>
                        <p className="text-stone-700 mt-0.5">{rec.likelyCause}</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/50 flex items-start justify-between gap-4">
                      <div>
                        <span className="text-sm font-medium text-stone-900">Recommended Action:</span>
                        <p className="text-sm text-stone-700 mt-0.5">{rec.recommendedAction}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-medium text-stone-900">Expected Impact:</span>
                        <p className="text-sm text-stone-700 mt-0.5">{rec.expectedImpact}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
