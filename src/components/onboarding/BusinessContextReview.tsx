import { useState } from 'react';
import { X, Plus, Globe, FileText, BarChart3, Settings } from 'lucide-react';
import { OnboardingCard } from './OnboardingCard';
import type { MockCompiledProfile, MockSource } from '@/lib/onboarding/types';

type BusinessContextReviewProps = {
  profile: MockCompiledProfile;
  sources: MockSource[];
  onUpdateProfile: (field: keyof MockCompiledProfile, value: unknown) => void;
};

const TAG_COLORS = [
  { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-100' },
  { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-100' },
  { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-100' },
  { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-100' },
  { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-100' },
];

export function BusinessContextReview({ profile, sources, onUpdateProfile }: BusinessContextReviewProps) {
  const [newAudience, setNewAudience] = useState('');
  const [newOffering, setNewOffering] = useState('');
  const readinessPct = profile.summary && profile.offerings.length > 0 ? 85 : 30;

  const websiteSource = sources.find((s) => s.sourceType === 'website');
  const uploadSources = sources.filter((s) => s.sourceType === 'upload');
  const firstSourceLabel = websiteSource?.externalReference || uploadSources[0]?.sourceName || 'Not provided';

  const removeAudience = (index: number) => {
    const updated = profile.targetAudiences.filter((_, i) => i !== index);
    onUpdateProfile('targetAudiences', updated);
  };

  const addAudience = () => {
    if (!newAudience.trim()) return;
    onUpdateProfile('targetAudiences', [...profile.targetAudiences, newAudience.trim()]);
    setNewAudience('');
  };

  const removeOffering = (index: number) => {
    const updated = profile.offerings.filter((_, i) => i !== index);
    onUpdateProfile('offerings', updated);
  };

  const addOffering = () => {
    if (!newOffering.trim()) return;
    onUpdateProfile('offerings', [...profile.offerings, newOffering.trim()]);
    setNewOffering('');
  };

  const removeValueProp = (index: number) => {
    const updated = profile.valuePropositions.filter((_, i) => i !== index);
    onUpdateProfile('valuePropositions', updated);
  };

  return (
    <div className="grid gap-6">
      {/* Page header + readiness score */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold text-foreground">Review Business Context</h2>
          <p className="mt-2 text-base text-muted-foreground">
            Our AI has synthesized your brand&apos;s identity from your provided sources. Verify the details below to ensure perfect campaign alignment.
          </p>
        </div>

        {/* Profile Readiness Score */}
        <div className="flex min-w-[240px] items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="relative flex size-16 items-center justify-center">
            <svg className="size-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-muted/30"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeDasharray="100, 100"
                strokeWidth="3"
              />
              <path
                className="text-success"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeDasharray={`${readinessPct}, 100`}
                strokeWidth="3"
              />
            </svg>
            <span className="absolute text-lg font-bold text-foreground">
              {readinessPct}<span className="text-xs">%</span>
            </span>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Profile Readiness</h4>
            <p className="text-xs text-muted-foreground">Excellent context extracted</p>
          </div>
        </div>
      </div>

      {/* 3-col grid: Core Identity | Key Offerings | Value Propositions */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Col 1: Core Identity */}
        <div className="md:col-span-1">
          <OnboardingCard className="flex h-full flex-col">
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-lg bg-muted p-2 text-primary">
                <Globe className="size-4" />
              </span>
              <h3 className="text-lg font-semibold text-foreground">Core Identity</h3>
            </div>
            <textarea
              className="min-h-[120px] w-full resize-none rounded-xl border border-border bg-muted/50 p-4 text-sm leading-relaxed text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={profile.summary}
              placeholder="Describe your business identity..."
              onChange={(e) => onUpdateProfile('summary', e.target.value)}
            />
            <div className="mt-4 inline-flex items-center gap-2 self-start rounded-lg border border-border bg-muted px-3 py-1.5">
              <Globe className="size-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Source: {firstSourceLabel}</span>
            </div>
          </OnboardingCard>
        </div>

        {/* Col 2-3: Key Offerings + Value Propositions */}
        <div className="space-y-6 md:col-span-2">
          {/* Key Offerings */}
          <OnboardingCard>
            <div className="mb-6 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-blue-50 p-2 text-blue-600">
                  <FileText className="size-4" />
                </span>
                <h3 className="text-lg font-semibold text-foreground">Key Offerings</h3>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5">
                <FileText className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{firstSourceLabel}</span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {profile.offerings.map((item, i) => (
                <div
                  key={i}
                  className="group relative flex items-center rounded-2xl border border-border bg-muted/50 p-4 transition-colors hover:border-primary/50"
                >
                  <p className="flex-1 text-sm font-medium text-foreground">{item}</p>
                  <button
                    onClick={() => removeOffering(i)}
                    className="absolute right-4 text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border p-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground">
                <Plus className="size-4" />
                <input
                  type="text"
                  placeholder="Add Offering"
                  value={newOffering}
                  onChange={(e) => setNewOffering(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addOffering()}
                  className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
          </OnboardingCard>

          {/* Value Propositions */}
          <OnboardingCard>
            <div className="mb-6 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-amber-50 p-2 text-amber-500">
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                </span>
                <h3 className="text-lg font-semibold text-foreground">Value Propositions</h3>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5">
                <Globe className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">From {firstSourceLabel}</span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {profile.valuePropositions.map((item, i) => (
                <div
                  key={i}
                  className="group relative rounded-2xl border border-border bg-muted/50 p-5 transition-shadow hover:shadow-md"
                >
                  <input
                    type="text"
                    className="mb-1 w-full border-none bg-transparent text-base font-semibold text-foreground outline-none focus:ring-0"
                    value={item}
                    onChange={(e) => {
                      const updated = [...profile.valuePropositions];
                      updated[i] = e.target.value;
                      onUpdateProfile('valuePropositions', updated);
                    }}
                  />
                  <button
                    onClick={() => removeValueProp(i)}
                    className="absolute right-4 top-4 text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </OnboardingCard>
        </div>
      </div>

      {/* 2-col grid: Target Audiences + Funnel Goals */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Target Audiences */}
        <OnboardingCard>
          <div className="mb-6 flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-purple-50 p-2 text-purple-600">
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
              <h3 className="text-lg font-semibold text-foreground">Target Audiences</h3>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5">
              <BarChart3 className="size-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{firstSourceLabel}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {profile.targetAudiences.map((audience, i) => {
              const color = TAG_COLORS[i % TAG_COLORS.length];
              return (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 font-medium ${color.bg} ${color.text} ${color.border}`}
                >
                  <span className="text-sm">{audience}</span>
                  <button onClick={() => removeAudience(i)} className="ml-1">
                    <X className="size-4 hover:opacity-80" />
                  </button>
                </div>
              );
            })}
            <div className="flex items-center gap-1 rounded-xl border border-dashed border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50">
              <Plus className="size-4" />
              <input
                type="text"
                placeholder="New Segment"
                value={newAudience}
                onChange={(e) => setNewAudience(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addAudience()}
                className="w-28 bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
        </OnboardingCard>

        {/* Funnel Goals */}
        <OnboardingCard>
          <div className="mb-6 flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-green-50 p-2 text-success">
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" y1="22" x2="4" y2="15" />
                </svg>
              </span>
              <h3 className="text-lg font-semibold text-foreground">Funnel Goals</h3>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5">
              <Settings className="size-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">User provided</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Primary Conversion
              </label>
              <select
                className="h-12 w-full appearance-none rounded-xl border border-border bg-muted/50 px-4 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={profile.funnelGoal}
                onChange={(e) => onUpdateProfile('funnelGoal', e.target.value)}
              >
                <option value="">Select a goal...</option>
                <option>Generate qualified sales conversations</option>
                <option>Sign-up Success</option>
                <option>Purchase Complete</option>
                <option>Demo Request</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Target CPA
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3.5 font-medium text-muted-foreground">$</span>
                <input
                  type="text"
                  className="h-12 w-full rounded-xl border border-border bg-muted/50 pl-8 pr-4 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  value={profile.targetCpa.replace('$', '')}
                  onChange={(e) => onUpdateProfile('targetCpa', `$${e.target.value}`)}
                />
              </div>
            </div>
          </div>
        </OnboardingCard>
      </div>

      {/* Add Data Source dashed card */}
      <div className="flex cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-border bg-card p-8 text-center transition-all hover:border-primary hover:bg-muted/30">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          <Plus className="size-7" />
        </div>
        <div>
          <h4 className="text-lg font-semibold text-foreground">Add another data source</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload PDFs, spreadsheets, or link your social profiles
          </p>
        </div>
      </div>
    </div>
  );
}
