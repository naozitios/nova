'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, AlertCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { AccountIssue, HealthSummary, IssueCategory, IssueSeverity } from '@/types/optimization';

const mockIssues: AccountIssue[] = [
  { id: 'iss1', severity: 'critical', category: 'tracking', finding: 'Conversion API not configured', evidence: 'No CAPI events detected in the last 7 days', recommendation: 'Configure CAPI to improve attribution accuracy and event tracking reliability.', status: 'open' },
  { id: 'iss2', severity: 'critical', category: 'tracking', finding: 'Missing Purchase event detected', evidence: 'Purchase event missing from pixel fire on checkout page', recommendation: 'Add Purchase event to your checkout flow to track conversions properly.', status: 'open' },
  { id: 'iss3', severity: 'warning', category: 'tracking', finding: 'Event duplication detected', evidence: 'PageView event firing 3x per page load', recommendation: 'Deduplicate events to prevent inflated metrics and inaccurate reporting.', status: 'open' },
  { id: 'iss4', severity: 'warning', category: 'attribution', finding: 'Attribution window not optimized', evidence: 'Currently using 28-day click, 1-day view window', recommendation: 'Consider 7-day click, 1-day view for better alignment with purchase cycle.', status: 'open' },
  { id: 'iss5', severity: 'warning', category: 'utm', finding: 'Missing UTM parameters on campaigns', evidence: '3 campaigns have no UTM tracking on destination URLs', recommendation: 'Add UTM parameters to all campaign destination URLs for consistent tracking.', status: 'open' },
  { id: 'iss6', severity: 'warning', category: 'naming', finding: 'Campaign naming convention violation', evidence: '"Summer Launch" does not follow [Platform]_[Objective]_[Date] format', recommendation: 'Rename campaign to follow the standard naming convention for consistency.', status: 'open' },
  { id: 'iss7', severity: 'info', category: 'tracking', finding: 'Event match quality below 50%', evidence: 'Current match quality is 42% for Purchase events', recommendation: 'Improve customer data passed with events to increase match quality.', status: 'open' },
  { id: 'iss8', severity: 'info', category: 'attribution', finding: 'Domain not verified', evidence: 'example.com has not been verified in Meta Business Settings', recommendation: 'Verify your domain to unlock additional attribution features and reporting.', status: 'resolved' },
  { id: 'iss9', severity: 'info', category: 'utm', finding: 'Invalid UTM naming inconsistency', evidence: 'UTM source uses "fb", "facebook", "meta" interchangeably', recommendation: 'Standardize UTM source values across all campaigns.', status: 'open' },
];

function computeHealth(issues: AccountIssue[]): HealthSummary {
  const open = issues.filter(i => i.status !== 'resolved');
  const critical = open.filter(i => i.severity === 'critical').length;
  const warnings = open.filter(i => i.severity === 'warning').length;
  const passed = issues.filter(i => i.status === 'resolved').length + Math.max(0, 10 - open.length);
  const score = Math.max(0, Math.min(100, 100 - critical * 15 - warnings * 5));
  return { score, criticalCount: critical, warningCount: warnings, passedCount: passed, issues };
}

const severityColors: Record<IssueSeverity, string> = {
  critical: 'bg-red-50 border-red-200 text-red-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  info: 'bg-blue-50 border-blue-200 text-blue-700',
};

const severityBadge: Record<IssueSeverity, string> = {
  critical: 'bg-red-100 text-red-700',
  warning: 'bg-amber-100 text-amber-700',
  info: 'bg-blue-100 text-blue-700',
};

const categoryLabels: Record<IssueCategory, string> = {
  tracking: 'Tracking',
  attribution: 'Attribution',
  utm: 'UTM Governance',
  naming: 'Naming Conventions',
};

export default function AccountHealth() {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<IssueSeverity | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<IssueCategory | 'all'>('all');

  const health = useMemo(() => computeHealth(mockIssues), []);

  const filtered = useMemo(() => {
    return health.issues.filter(i => {
      if (severityFilter !== 'all' && i.severity !== severityFilter) return false;
      if (categoryFilter !== 'all' && i.category !== categoryFilter) return false;
      if (search && !i.finding.toLowerCase().includes(search.toLowerCase()) && !i.evidence.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [health.issues, search, severityFilter, categoryFilter]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-stone-900">Account Health Score</h2>
              <p className="text-stone-500 text-sm mt-1">Overall account configuration health</p>
            </div>
            <div className="text-center">
              <div className={`text-4xl font-bold ${health.score >= 80 ? 'text-green-600' : health.score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                {health.score}
              </div>
              <div className="text-sm text-stone-500">/ 100</div>
            </div>
          </div>
          <Progress value={health.score} className={`h-3 ${health.score >= 80 ? '[&>[data-slot=progress-indicator]]:bg-green-500' : health.score >= 50 ? '[&>[data-slot=progress-indicator]]:bg-amber-500' : '[&>[data-slot=progress-indicator]]:bg-red-500'}`} />
          <div className="flex items-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-stone-600">{health.criticalCount} Critical</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-stone-600">{health.warningCount} Warnings</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-stone-600">{health.passedCount} Passed</span>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100">
          <h3 className="font-semibold text-stone-900 mb-4">Audit Categories</h3>
          <div className="space-y-3">
            {(['tracking', 'attribution', 'utm', 'naming'] as IssueCategory[]).map(cat => {
              const count = health.issues.filter(i => i.category === cat && i.status !== 'resolved').length;
              return (
                <div key={cat} className="flex items-center justify-between">
                  <span className="text-sm text-stone-600">{categoryLabels[cat]}</span>
                  <span className={`text-sm font-medium ${count > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    {count > 0 ? `${count} issue${count > 1 ? 's' : ''}` : 'All clear'}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input placeholder="Search issues..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-10 rounded-full bg-white border-stone-200" />
        </div>
        <div className="flex gap-2">
          {(['all', 'critical', 'warning', 'info'] as const).map(s => (
            <Button key={s} variant={severityFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setSeverityFilter(s)} className={severityFilter === s ? 'bg-stone-900 text-white rounded-full' : 'rounded-full'}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          {(['all', 'tracking', 'attribution', 'utm', 'naming'] as const).map(c => (
            <Button key={c} variant={categoryFilter === c ? 'default' : 'outline'} size="sm" onClick={() => setCategoryFilter(c)} className={categoryFilter === c ? 'bg-stone-900 text-white rounded-full' : 'rounded-full'}>
              {c === 'all' ? 'All' : categoryLabels[c]}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-stone-600 font-medium">No issues found</p>
            <p className="text-stone-400 text-sm mt-1">All checks are passing for this filter</p>
          </div>
        ) : (
          filtered.map((issue, i) => (
            <motion.div key={issue.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className={`rounded-2xl p-5 border ${severityColors[issue.severity]}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {issue.severity === 'critical' ? <AlertTriangle className="w-4 h-4" /> : issue.severity === 'warning' ? <AlertCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <Badge className={severityBadge[issue.severity]}>
                      {issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)}
                    </Badge>
                    <Badge variant="outline">{categoryLabels[issue.category]}</Badge>
                    <Badge variant={issue.status === 'resolved' ? 'secondary' : 'default'} className={issue.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-600'}>
                      {issue.status === 'resolved' ? 'Resolved' : 'Open'}
                    </Badge>
                  </div>
                  <h4 className="font-semibold text-stone-900 mb-1">{issue.finding}</h4>
                  <p className="text-sm text-stone-600 mb-2">{issue.evidence}</p>
                  <p className="text-sm text-stone-500"><span className="font-medium">Recommendation:</span> {issue.recommendation}</p>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
