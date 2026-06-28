'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Check, Loader2, AlertCircle, Clock, RotateCcw,
  FileText, GitBranch, Eye, Target, DollarSign, Calendar, Globe, User,
  Languages, Edit3, History, ListChecks, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { campaignStore, ensureSeeded, CampaignConfig, CampaignVersion, ExecutionPlan, DriftReport } from '@/lib/campaign-engine';
import { CampaignFormInput, configToFormInput } from '@/lib/campaign-engine/generator';
import { Platform } from '@/types/advertising';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-amber-100 text-amber-700',
  draft: 'bg-stone-100 text-stone-600',
  completed: 'bg-blue-100 text-blue-700',
  failed: 'bg-red-100 text-red-700',
};

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-3">
      <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-stone-500" />
      </div>
      <div>
        <div className="text-xs text-stone-400">{label}</div>
        <div className="text-sm font-medium text-stone-900">{value}</div>
      </div>
    </div>
  );
}

function VersionTimeline({ versions, onRollback }: { versions: CampaignVersion[]; onRollback: (v: number) => void }) {
  const [rollingBack, setRollingBack] = useState<number | null>(null);

  if (versions.length === 0) {
    return <div className="text-center py-12 text-stone-400">No version history yet</div>;
  }

  const handleRollback = async (v: number) => {
    setRollingBack(v);
    await onRollback(v);
    setRollingBack(null);
  };

  return (
    <div className="space-y-4">
      {[...versions].reverse().map((version, idx) => {
        const isLatest = idx === 0;
        const changeCount = version.diffs.length;

        return (
          <motion.div
            key={version.version}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={`relative pl-8 pb-6 ${idx < versions.length - 1 ? 'border-l-2 border-stone-200' : ''}`}
          >
            <div className={`absolute left-[-9px] top-0 w-4 h-4 rounded-full border-2 ${
              isLatest ? 'bg-[#E55A3C] border-[#E55A3C]' : 'bg-white border-stone-300'
            }`} />
            <div className="bg-white rounded-xl p-4 shadow-sm border border-stone-100">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs font-mono">v{version.version}</Badge>
                    {isLatest && <Badge className="bg-[#E55A3C]/10 text-[#E55A3C] text-xs">Current</Badge>}
                  </div>
                  <p className="font-medium text-stone-900 text-sm">{version.commitMessage}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-stone-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(version.timestamp).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {version.authoredBy}
                    </span>
                    <span>{changeCount} change{changeCount !== 1 ? 's' : ''}</span>
                  </div>
                  {!isLatest && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {version.diffs.slice(0, 3).map((d, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 truncate max-w-[200px]">
                          {d.changeType === 'added' ? '+' : d.changeType === 'removed' ? '-' : '~'} {d.path}
                        </span>
                      ))}
                      {version.diffs.length > 3 && (
                        <span className="text-xs px-2 py-0.5 text-stone-400">+{version.diffs.length - 3} more</span>
                      )}
                    </div>
                  )}
                </div>
                {!isLatest && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0 rounded-full text-xs gap-1"
                    onClick={() => handleRollback(version.version)}
                    disabled={rollingBack === version.version}
                  >
                    {rollingBack === version.version ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3 h-3" />
                    )}
                    Rollback
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function ExecutionPlanView({ plan }: { plan: ExecutionPlan | null }) {
  if (!plan) {
    return <div className="text-center py-12 text-stone-400">No execution plan generated yet</div>;
  }

  const hasChanges = plan.changes.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Additions', value: plan.summary.additions, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Modifications', value: plan.summary.modifications, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Removals', value: plan.summary.removals, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 text-center`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-stone-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {hasChanges ? (
        <div className="space-y-3">
          <h4 className="font-medium text-stone-900 text-sm">Platform Actions</h4>
          {plan.platformActions.map((action, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-stone-100 text-sm">
              <div className={`w-2 h-2 rounded-full ${
                action.action === 'create' ? 'bg-green-500' :
                action.action === 'delete' ? 'bg-red-500' : 'bg-amber-500'
              }`} />
              <Badge variant="outline" className="text-xs capitalize">{action.platform}</Badge>
              <span className="text-stone-700 capitalize">{action.action}</span>
              <span className="text-stone-400">{action.resource.replace('_', ' ')}</span>
              <span className="text-stone-500 ml-auto text-xs truncate">{action.details}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 rounded-xl bg-stone-50 border border-stone-200 text-center">
          <Check className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-stone-600">No pending changes. Campaign is up to date.</p>
        </div>
      )}
    </div>
  );
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [entry, setEntry] = useState(() => {
    ensureSeeded();
    return campaignStore.get(id);
  });
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<CampaignFormInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [drift, setDrift] = useState<DriftReport | null>(null);

  useEffect(() => {
    if (!entry) return;
    setForm(configToFormInput(entry.config));
    setPlan(campaignStore.getExecutionPlan(id));

    const storedUser = localStorage.getItem('user');
    const simulatedPlatformState: Partial<CampaignConfig> | null = storedUser ? {
      name: entry.config.name,
      totalBudget: entry.config.totalBudget,
      startDate: entry.config.startDate,
      endDate: entry.config.endDate,
      objective: entry.config.objective,
    } : null;
    if (simulatedPlatformState) {
      setDrift(campaignStore.checkDrift(id, simulatedPlatformState));
    }
  }, [entry, id]);

  if (!entry || !form) {
    return (
      <div className="min-h-screen bg-stone-50 pt-28 pb-16 px-6 md:px-12 lg:px-24">
        <div className="max-w-4xl mx-auto text-center py-24">
          <AlertCircle className="w-12 h-12 text-stone-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-stone-900 mb-2">Campaign Not Found</h2>
          <p className="text-stone-500 mb-6">This campaign doesn&apos;t exist or has been deleted.</p>
          <Button onClick={() => router.push('/campaigns')} className="rounded-full">
            Back to Campaigns
          </Button>
        </div>
      </div>
    );
  }

  const config = entry.config;
  const versions = campaignStore.getVersionHistory(id);
  const adSet = config.adSets[0];

  const update = (key: string, val: string | string[]) => setForm(f => f ? { ...f, [key]: val } : f);

  const canSave = () => {
    if (!form) return false;
    return form.name && form.platform.length > 0 && form.totalBudget && form.startDate && form.endDate
      && form.countries && form.languages && form.headline && form.bodyText && form.destinationUrl;
  };

  const handleSave = async () => {
    if (!form || !canSave()) return;
    setSaving(true);
    setSaveError(null);

    try {
      const storedUser = localStorage.getItem('user');
      const userName = storedUser ? JSON.parse(storedUser).name : 'system';
      const result = campaignStore.update(id, form, userName, 'Campaign updated via detail form');
      if (result.errors.length > 0) {
        setSaveError(result.errors.join(', '));
      } else {
        setEntry(campaignStore.get(id));
        setIsEditing(false);
        if (result.plan) setPlan(result.plan);
      }
    } catch {
      setSaveError('Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  const handleRollback = async (versionNumber: number) => {
    const storedUser = localStorage.getItem('user');
    const userName = storedUser ? JSON.parse(storedUser).name : 'system';
    const result = campaignStore.rollback(id, versionNumber, userName);
    if (!result.errors.length) {
      setEntry(campaignStore.get(id));
      setForm(configToFormInput(result.config!));
      setPlan(campaignStore.getExecutionPlan(id));
      setActiveTab('overview');
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 pt-28 pb-16 px-6 md:px-12 lg:px-24">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => router.push('/campaigns')} className="flex items-center gap-2 text-stone-500 hover:text-stone-900 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to campaigns
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-stone-900">{config.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge className={statusColors.draft || 'bg-stone-100 text-stone-600 capitalize'}>active</Badge>
              {config.platform.map(p => (
                <Badge key={p} variant="outline" className="capitalize">{p}</Badge>
              ))}
              <span className="text-sm text-stone-400">
                v{entry.currentVersion} · {entry.versions.length} version{entry.versions.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {!isEditing && (
              <Button onClick={() => { setIsEditing(true); setActiveTab('edit'); }} className="bg-[#E55A3C] hover:bg-[#D14A2E] rounded-full gap-2">
                <Edit3 className="w-4 h-4" /> Edit Campaign
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border border-stone-200 rounded-2xl p-1">
            <TabsTrigger value="overview" className="rounded-xl gap-2 data-[state=active]:bg-stone-900 data-[state=active]:text-white">
              <Eye className="w-4 h-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="edit" className="rounded-xl gap-2 data-[state=active]:bg-stone-900 data-[state=active]:text-white">
              <Edit3 className="w-4 h-4" /> Edit
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-xl gap-2 data-[state=active]:bg-stone-900 data-[state=active]:text-white">
              <History className="w-4 h-4" /> History
            </TabsTrigger>
            <TabsTrigger value="plan" className="rounded-xl gap-2 data-[state=active]:bg-stone-900 data-[state=active]:text-white">
              <ListChecks className="w-4 h-4" /> Execution Plan
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <TabsContent value="overview" className="mt-0 space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
                    <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#E55A3C]" /> Campaign Settings
                    </h3>
                    <div className="divide-y divide-stone-50">
                      <InfoRow icon={Target} label="Objective" value={config.objective.replace(/_/g, ' ').toLowerCase()} />
                      <InfoRow icon={DollarSign} label="Total Budget" value={`$${config.totalBudget.toLocaleString()}`} />
                      <InfoRow icon={Calendar} label="Start Date" value={config.startDate} />
                      <InfoRow icon={Calendar} label="End Date" value={config.endDate} />
                      <InfoRow icon={Globe} label="Platforms" value={config.platform.map(p => p === 'meta' ? 'Meta Ads' : 'Google Ads').join(', ')} />
                    </div>
                  </div>

                  {adSet && (
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
                      <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
                        <Target className="w-4 h-4 text-[#E55A3C]" /> Targeting
                      </h3>
                      <div className="divide-y divide-stone-50">
                        <InfoRow icon={Globe} label="Countries" value={adSet.targeting.countries.join(', ')} />
                        <InfoRow icon={User} label="Age Range" value={`${adSet.targeting.ageRange[0]} - ${adSet.targeting.ageRange[1]}`} />
                        <InfoRow icon={Languages} label="Languages" value={adSet.targeting.languages.join(', ')} />
                        <InfoRow icon={DollarSign} label="Bid Amount" value={`$${adSet.bidAmount}`} />
                      </div>
                    </div>
                  )}
                </div>

                {adSet?.creatives[0] && (
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
                    <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#E55A3C]" /> Creative
                    </h3>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs text-stone-400 mb-1">Headline</div>
                          <div className="font-medium text-stone-900">{adSet.creatives[0].headline}</div>
                        </div>
                        <div>
                          <div className="text-xs text-stone-400 mb-1">Body Text</div>
                          <div className="text-sm text-stone-700">{adSet.creatives[0].bodyText}</div>
                        </div>
                        <div>
                          <div className="text-xs text-stone-400 mb-1">Destination URL</div>
                          <div className="text-sm text-blue-600 truncate">{adSet.creatives[0].destinationUrl}</div>
                        </div>
                      </div>
                      {adSet.creatives[0].mediaUrl && (
                        <div className="rounded-xl overflow-hidden border border-stone-200">
                          <img src={adSet.creatives[0].mediaUrl} alt="Creative preview" className="w-full h-40 object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {drift?.hasDrift && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">Configuration drift detected</p>
                      <p className="text-sm text-amber-700 mt-1">The internal configuration differs from the platform state. Review and synchronize.</p>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="edit" className="mt-0">
                {isEditing ? (
                  <div className="bg-white rounded-2xl p-8 shadow-sm border border-stone-100 space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <Label htmlFor="name">Campaign Name</Label>
                        <Input id="name" value={form.name} onChange={e => update('name', e.target.value)} className="h-11 mt-1.5" />
                      </div>
                    </div>

                    <div>
                      <Label>Platforms</Label>
                      <div className="flex gap-3 mt-1.5">
                        {(['meta', 'google'] as Platform[]).map(p => (
                          <button
                            key={p}
                            onClick={() => {
                              const next = form.platform.includes(p)
                                ? form.platform.filter((x: string) => x !== p)
                                : [...form.platform, p];
                              update('platform', next);
                            }}
                            className={`flex-1 p-4 rounded-2xl border-2 text-center transition-all ${
                              form.platform.includes(p) ? 'border-[#E55A3C] bg-[#E55A3C]/5' : 'border-stone-200 hover:border-stone-300'
                            }`}
                          >
                            <div className={`text-lg font-semibold ${form.platform.includes(p) ? 'text-[#E55A3C]' : 'text-stone-700'}`}>
                              {p === 'meta' ? 'Meta Ads' : 'Google Ads'}
                            </div>
                            <div className="text-xs text-stone-400 mt-1">{p === 'meta' ? 'Facebook & Instagram' : 'Search & Display'}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <Label>Objective</Label>
                        <Select value={form.objective} onValueChange={v => update('objective', v)}>
                          <SelectTrigger className="h-11 mt-1.5"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CONVERSIONS">Conversions</SelectItem>
                            <SelectItem value="BRAND_AWARENESS">Brand Awareness</SelectItem>
                            <SelectItem value="TRAFFIC">Traffic</SelectItem>
                            <SelectItem value="RETENTION">Retention</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Total Budget ($)</Label>
                        <Input type="number" value={form.totalBudget} onChange={e => update('totalBudget', e.target.value)} className="h-11 mt-1.5" />
                      </div>
                      <div>
                        <Label>Bid Amount ($)</Label>
                        <Input type="number" value={form.ageMin} onChange={e => update('ageMin', e.target.value)} className="h-11 mt-1.5" />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label>Start Date</Label>
                        <Input type="date" value={form.startDate} onChange={e => update('startDate', e.target.value)} className="h-11 mt-1.5" />
                      </div>
                      <div>
                        <Label>End Date</Label>
                        <Input type="date" value={form.endDate} onChange={e => update('endDate', e.target.value)} className="h-11 mt-1.5" />
                      </div>
                    </div>

                    <div className="border-t border-stone-100 pt-6">
                      <h4 className="font-semibold text-stone-900 mb-4">Targeting</h4>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <Label>Target Countries</Label>
                          <Input value={form.countries} onChange={e => update('countries', e.target.value)} className="h-11 mt-1.5" />
                        </div>
                        <div className="flex gap-2">
                          <div>
                            <Label>Min Age</Label>
                            <Input type="number" value={form.ageMin} onChange={e => update('ageMin', e.target.value)} className="h-11 mt-1.5" />
                          </div>
                          <div>
                            <Label>Max Age</Label>
                            <Input type="number" value={form.ageMax} onChange={e => update('ageMax', e.target.value)} className="h-11 mt-1.5" />
                          </div>
                        </div>
                        <div>
                          <Label>Languages</Label>
                          <Input value={form.languages} onChange={e => update('languages', e.target.value)} className="h-11 mt-1.5" />
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-stone-100 pt-6">
                      <h4 className="font-semibold text-stone-900 mb-4">Creative</h4>
                      <div className="space-y-4">
                        <div>
                          <Label>Primary Headline</Label>
                          <Input value={form.headline} onChange={e => update('headline', e.target.value)} className="h-11 mt-1.5" />
                        </div>
                        <div>
                          <Label>Body Text</Label>
                          <Textarea value={form.bodyText} onChange={e => update('bodyText', e.target.value)} className="mt-1.5" rows={3} />
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <Label>Destination URL</Label>
                            <Input value={form.destinationUrl} onChange={e => update('destinationUrl', e.target.value)} className="h-11 mt-1.5" />
                          </div>
                          <div>
                            <Label>Media URL (Image)</Label>
                            <Input value={form.mediaUrl} onChange={e => update('mediaUrl', e.target.value)} className="h-11 mt-1.5" />
                          </div>
                        </div>
                        {form.mediaUrl && (
                          <div className="rounded-2xl overflow-hidden border border-stone-200 max-w-sm">
                            <img src={form.mediaUrl} alt="Preview" className="w-full h-40 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          </div>
                        )}
                      </div>
                    </div>

                    {saveError && (
                      <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700">{saveError}</p>
                      </div>
                    )}

                    <div className="flex justify-between pt-4 border-t border-stone-100">
                      <Button variant="outline" onClick={() => { setIsEditing(false); setForm(configToFormInput(entry.config)); setSaveError(null); }} className="rounded-full">
                        Cancel
                      </Button>
                      <Button onClick={handleSave} disabled={saving || !canSave()} className="bg-[#E55A3C] hover:bg-[#D14A2E] rounded-full px-8 gap-2">
                        {saving ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                        ) : (
                          <><Check className="w-4 h-4" /> Save Changes</>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <Edit3 className="w-12 h-12 text-stone-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-stone-900 mb-2">Ready to make changes?</h3>
                    <p className="text-stone-500 mb-6">Editing will create a new version with a full change history.</p>
                    <Button onClick={() => setIsEditing(true)} className="bg-[#E55A3C] hover:bg-[#D14A2E] rounded-full gap-2">
                      <Edit3 className="w-4 h-4" /> Edit Campaign
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-0">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-semibold text-stone-900 flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-[#E55A3C]" /> Version History
                      </h3>
                      <p className="text-sm text-stone-400 mt-1">Every change is tracked and reversible</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{versions.length} version{versions.length !== 1 ? 's' : ''}</Badge>
                  </div>
                  <VersionTimeline versions={versions} onRollback={handleRollback} />
                </div>
              </TabsContent>

              <TabsContent value="plan" className="mt-0">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
                  <div className="mb-6">
                    <h3 className="font-semibold text-stone-900 flex items-center gap-2">
                      <ListChecks className="w-4 h-4 text-[#E55A3C]" /> Execution Plan
                    </h3>
                    <p className="text-sm text-stone-400 mt-1">
                      Generated at {plan ? new Date(plan.generatedAt).toLocaleString() : '—'}
                    </p>
                  </div>
                  <ExecutionPlanView plan={plan} />
                </div>
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </div>
    </div>
  );
}
