'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, ArrowUp, ArrowDown, Wrench, Rocket, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { OptimizationAction, ActionCategory, ActionStatus, ActionPriority, ActionRisk } from '@/types/optimization';

const mockActions: OptimizationAction[] = [
  {
    id: 'act1', action: 'Increase PMax budget by 25%', source: 'Optimization Copilot', priority: 'high', risk: 'low',
    estimatedImpact: '+20-30% conversions', status: 'pending_review', category: 'scale',
    description: 'Increase daily budget for PMax - Evergreen campaign from $267 to $334 to capture additional converting traffic.',
    reason: 'Campaign has maintained 3.2x ROAS for 14 days with CPA 28% below target.',
    evidence: 'Consistent performance metrics indicate room to scale while maintaining efficiency.',
    affectedCampaigns: ['PMax - Evergreen'],
    approvalHistory: [], createdAt: '2026-06-28T09:30:00Z',
  },
  {
    id: 'act2', action: 'Reduce retargeting budget by 30%', source: 'Optimization Copilot', priority: 'high', risk: 'medium',
    estimatedImpact: '+15% blended ROAS', status: 'pending_review', category: 'reduce',
    description: 'Reduce budget for Retargeting - Abandoned Cart campaign from $83/day to $58/day.',
    reason: 'Conversion rate dropped from 4.2% to 2.8% with spend increasing 40% MoM.',
    evidence: 'Audience saturation detected — most abandoners have already been reached.',
    affectedCampaigns: ['Retargeting - Abandoned Cart'],
    approvalHistory: [], createdAt: '2026-06-28T08:00:00Z',
  },
  {
    id: 'act3', action: 'Configure Conversion API', source: 'Account Health', priority: 'high', risk: 'low',
    estimatedImpact: 'Improved attribution accuracy', status: 'pending_review', category: 'fix',
    description: 'Set up Conversion API (CAPI) to enable server-side event tracking alongside the Meta Pixel.',
    reason: 'CAPI is not configured. Server-side tracking improves attribution reliability and event match quality.',
    evidence: 'No CAPI events detected in last 7 days. Current match quality at 42%.',
    affectedCampaigns: ['All Meta campaigns'],
    approvalHistory: [], createdAt: '2026-06-28T06:00:00Z',
  },
  {
    id: 'act4', action: 'Rotate creatives for Summer Collection', source: 'Optimization Copilot', priority: 'medium', risk: 'low',
    estimatedImpact: 'CPA reduction of ~18%', status: 'approved', category: 'fix',
    description: 'Reduce budget by 20% and launch 3 new creative variants for the Summer Collection Launch campaign.',
    reason: 'CPA increased 34% over 7 days due to creative fatigue (frequency at 3.8, CTR declining).',
    evidence: 'CTR decreased from 2.3% to 1.4%, frequency increased from 2.1 to 3.8.',
    affectedCampaigns: ['Summer Collection Launch'],
    approvalHistory: [{ action: 'approved', timestamp: '2026-06-28T12:00:00Z', user: 'Demo User' }],
    createdAt: '2026-06-28T10:00:00Z',
  },
  {
    id: 'act5', action: 'Launch brand awareness campaign', source: 'Manual', priority: 'medium', risk: 'medium',
    estimatedImpact: 'Reach 2M+ new users', status: 'pending_review', category: 'launch',
    description: 'Publish the Brand Awareness Q3 draft campaign for Google Display Network.',
    reason: 'Q3 planning requires early launch to maximize reach and frequency goals.',
    evidence: 'Campaign has been in draft since June 20 with all creatives ready.',
    affectedCampaigns: ['Brand Awareness Q3'],
    approvalHistory: [], createdAt: '2026-06-27T16:00:00Z',
  },
  {
    id: 'act6', action: 'Add UTMs to 3 campaigns', source: 'Account Health', priority: 'medium', risk: 'low',
    estimatedImpact: 'Consistent cross-channel attribution', status: 'pending_review', category: 'fix',
    description: 'Add standardized UTM parameters to destination URLs for 3 campaigns missing tracking.',
    reason: 'Missing UTM parameters prevent accurate performance comparison across channels.',
    evidence: '3 campaigns have no UTM tracking on destination URLs.',
    affectedCampaigns: ['Summer Collection Launch', 'Holiday Flash Sale', 'Brand Awareness Q3'],
    approvalHistory: [], createdAt: '2026-06-27T10:00:00Z',
  },
];

const categoryLabels: Record<ActionCategory, string> = {
  scale: 'Scale',
  reduce: 'Reduce',
  fix: 'Fix',
  launch: 'Launch',
};

const categoryIcons: Record<ActionCategory, React.ElementType> = {
  scale: ArrowUp,
  reduce: ArrowDown,
  fix: Wrench,
  launch: Rocket,
};

const priorityBadge: Record<ActionPriority, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-blue-100 text-blue-700',
};

const riskBadge: Record<ActionRisk, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-green-100 text-green-700',
};

const statusBadge: Record<ActionStatus, string> = {
  pending_review: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  dismissed: 'bg-stone-100 text-stone-500',
  executed: 'bg-stone-900 text-white',
};

export default function ActionCenter() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ActionCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ActionStatus | 'all'>('all');
  const [actions, setActions] = useState(mockActions);

  const filtered = useMemo(() => {
    return actions.filter(a => {
      if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (search && !a.action.toLowerCase().includes(search.toLowerCase()) && !a.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [actions, search, categoryFilter, statusFilter]);

  const updateStatus = (id: string, newStatus: ActionStatus) => {
    setActions(prev => prev.map(a => a.id === id ? {
      ...a,
      status: newStatus,
      approvalHistory: newStatus === 'approved' || newStatus === 'rejected'
        ? [...a.approvalHistory, { action: newStatus, timestamp: new Date().toISOString(), user: 'Demo User' }]
        : a.approvalHistory,
    } : a));
  };

  const bulkUpdate = (ids: string[], newStatus: ActionStatus) => {
    setActions(prev => prev.map(a => ids.includes(a.id) ? {
      ...a,
      status: newStatus,
      approvalHistory: newStatus === 'approved' || newStatus === 'rejected'
        ? [...a.approvalHistory, { action: newStatus, timestamp: new Date().toISOString(), user: 'Demo User' }]
        : a.approvalHistory,
    } : a));
  };

  const pendingIds = filtered.filter(a => a.status === 'pending_review').map(a => a.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <Input placeholder="Search actions..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-10 rounded-full bg-white border-stone-200 w-64" />
          </div>
          <div className="flex gap-2">
            {(['all', 'scale', 'reduce', 'fix', 'launch'] as const).map(c => (
              <Button key={c} variant={categoryFilter === c ? 'default' : 'outline'} size="sm" onClick={() => setCategoryFilter(c)} className={categoryFilter === c ? 'bg-stone-900 text-white rounded-full' : 'rounded-full'}>
                {c === 'all' ? 'All' : categoryLabels[c]}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            {(['all', 'pending_review', 'approved', 'rejected', 'dismissed', 'executed'] as const).map(s => (
              <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s)} className={statusFilter === s ? 'bg-stone-900 text-white rounded-full' : 'rounded-full'}>
                {s === 'all' ? 'All' : s === 'pending_review' ? 'Pending' : s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
        </div>
        {pendingIds.length > 0 && (
          <div className="flex gap-2">
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white rounded-full" onClick={() => bulkUpdate(pendingIds, 'approved')}>
              <CheckCircle className="w-4 h-4 mr-1" /> Bulk Approve ({pendingIds.length})
            </Button>
            <Button size="sm" variant="outline" className="rounded-full text-red-600 border-red-200 hover:bg-red-50" onClick={() => bulkUpdate(pendingIds, 'rejected')}>
              <XCircle className="w-4 h-4 mr-1" /> Bulk Reject
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-stone-600 font-medium">No actions to review</p>
            <p className="text-stone-400 text-sm mt-1">All actions have been processed</p>
          </div>
        ) : (
          filtered.map((action, i) => {
            const Icon = categoryIcons[action.category];
            return (
              <motion.div key={action.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="bg-white rounded-2xl p-5 shadow-sm border border-stone-100 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FEF3E2] to-[#FFDAB9] flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[#E55A3C]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge className={statusBadge[action.status]}>
                        {action.status === 'pending_review' ? 'Pending Review' : action.status.charAt(0).toUpperCase() + action.status.slice(1)}
                      </Badge>
                      <Badge variant="outline">{categoryLabels[action.category]}</Badge>
                      <Badge className={priorityBadge[action.priority]}>{action.priority.charAt(0).toUpperCase() + action.priority.slice(1)} Priority</Badge>
                      <Badge className={riskBadge[action.risk]}>Risk: {action.risk.charAt(0).toUpperCase() + action.risk.slice(1)}</Badge>
                      <span className="text-xs text-stone-400">{action.source}</span>
                    </div>
                    <h4 className="font-semibold text-stone-900 mb-1">{action.action}</h4>
                    <p className="text-sm text-stone-600 mb-3">{action.description}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-stone-500">Why:</span>
                        <p className="text-stone-700 mt-0.5">{action.reason}</p>
                      </div>
                      <div>
                        <span className="text-stone-500">Expected Impact:</span>
                        <p className="text-stone-700 mt-0.5">{action.estimatedImpact}</p>
                      </div>
                      <div>
                        <span className="text-stone-500">Affected:</span>
                        <p className="text-stone-700 mt-0.5">{action.affectedCampaigns.join(', ')}</p>
                      </div>
                    </div>
                    {action.approvalHistory.length > 0 && (
                      <div className="text-xs text-stone-400 mb-3">
                        {action.approvalHistory.map((h, j) => (
                          <span key={j} className="mr-3">
                            {h.action === 'approved' ? 'Approved' : h.action === 'rejected' ? 'Rejected' : h.action} by {h.user} on {new Date(h.timestamp).toLocaleDateString()}
                          </span>
                        ))}
                      </div>
                    )}
                    {action.status === 'pending_review' && (
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white rounded-full" onClick={() => updateStatus(action.id, 'approved')}>
                          <CheckCircle className="w-4 h-4 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-full text-red-600 border-red-200 hover:bg-red-50" onClick={() => updateStatus(action.id, 'rejected')}>
                          <XCircle className="w-4 h-4 mr-1" /> Reject
                        </Button>
                        <Button size="sm" variant="ghost" className="rounded-full" onClick={() => updateStatus(action.id, 'dismissed')}>
                          Dismiss
                        </Button>
                      </div>
                    )}
                    {action.status === 'approved' && (
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" className="bg-stone-900 hover:bg-stone-800 text-white rounded-full" onClick={() => updateStatus(action.id, 'executed')}>
                          <Rocket className="w-4 h-4 mr-1" /> Execute
                        </Button>
                      </div>
                    )}
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
