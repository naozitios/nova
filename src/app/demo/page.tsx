'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Link2, Upload, Rocket, Activity, BarChart3,
  DollarSign, Eye, MousePointerClick, TrendingUp, Play, Target, Settings2, Sparkles,
  GitBranch, RotateCcw, ListChecks, FileJson, Clock, Shield, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const steps = [
  {
    id: 'connect',
    title: 'Step 1: Connect Your Ad Accounts',
    subtitle: 'Link Meta & Google in one click',
    icon: Link2,
    color: 'from-blue-500 to-blue-600',
    description: 'Securely authenticate with Meta Business Manager and Google Ads. We auto-discover your accounts, pages, and pixels.',
    content: (
      <div className="space-y-4">
        <div className="flex gap-4">
          {[
            { name: 'Meta Business Account', label: 'act_123456789', connected: true, icon: 'M', bg: 'bg-blue-50 text-blue-600' },
            { name: 'Google Ads', label: '123-456-7890', connected: true, icon: 'G', bg: 'bg-red-50 text-red-600' },
          ].map((acct) => (
            <div key={acct.name} className="flex-1 p-5 rounded-2xl border-2 border-green-200 bg-green-50/50">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${acct.bg}`}>{acct.icon}</div>
                <div className="flex-1">
                  <div className="font-medium text-stone-900">{acct.name}</div>
                  <div className="text-sm text-stone-400">{acct.label}</div>
                </div>
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <Badge className="bg-green-100 text-green-700">Connected</Badge>
            </div>
          ))}
        </div>
        <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-sm text-stone-600">
          <strong className="text-stone-900">Auto-detected:</strong> 3 Ad Accounts · 2 Pages · 1 Pixel · 1 Conversion Action
        </div>
      </div>
    ),
  },
  {
    id: 'assets',
    title: 'Step 2: Upload Your Creative Assets',
    subtitle: 'Centralized media library with validation',
    icon: Upload,
    color: 'from-purple-500 to-purple-600',
    description: 'Upload images and videos to your global asset repository. Our validator catches size/format issues before they reach ad networks.',
    content: (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { name: 'hero-shoe.jpg', status: 'valid', dims: '1200×1200' },
            { name: 'summer-banner.jpg', status: 'valid', dims: '1920×1080' },
            { name: 'brand-video.mp4', status: 'invalid', dims: '2400×1200', msg: 'Exceeds 60s limit for Meta Feed' },
          ].map((asset) => (
            <div key={asset.name} className={`p-4 rounded-xl border-2 ${
              asset.status === 'valid' ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className={`w-8 h-8 rounded-lg ${asset.status === 'valid' ? 'bg-green-100' : 'bg-red-100'} flex items-center justify-center`}>
                  {asset.status === 'valid' ? <Check className="w-4 h-4 text-green-600" /> : <span className="text-red-600 text-sm font-bold">!</span>}
                </div>
              </div>
              <div className="font-medium text-sm text-stone-900 truncate">{asset.name}</div>
              <div className="text-xs text-stone-400">{asset.dims}</div>
              {asset.msg && <div className="text-xs text-red-600 mt-1">{asset.msg}</div>}
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'create',
    title: 'Step 3: Launch a Cross-Channel Campaign',
    subtitle: 'Form → Hidden Config → Execution Plan → Publish',
    icon: Rocket,
    color: 'from-[#E55A3C] to-[#F4A574]',
    description: 'A single wizard-style form collects campaign settings. Nova generates a hidden internal config, computes an execution plan with every change tracked, then deploys to your platforms.',
    content: (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <FileJson className="w-4 h-4 text-stone-400" />
            <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Form Input</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-stone-400 mb-1">Campaign Name</div>
              <div className="font-medium text-stone-900">Summer Collection Launch</div>
            </div>
            <div>
              <div className="text-xs text-stone-400 mb-1">Budget</div>
              <div className="font-medium text-stone-900">$5,000</div>
            </div>
            <div>
              <div className="text-xs text-stone-400 mb-1">Platforms</div>
              <div className="flex gap-2">
                <Badge className="bg-blue-100 text-blue-700">Meta Ads</Badge>
                <Badge className="bg-red-100 text-red-700">Google Ads</Badge>
              </div>
            </div>
            <div>
              <div className="text-xs text-stone-400 mb-1">Objective</div>
              <div className="font-medium text-stone-900 capitalize">Conversions</div>
            </div>
          </div>
          <div className="border-t border-stone-100 pt-4">
            <div className="text-xs text-stone-400 mb-2">Targeting</div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">US</Badge>
              <Badge variant="outline">CA</Badge>
              <Badge variant="outline">UK</Badge>
              <Badge variant="outline">Ages 25-40</Badge>
              <Badge variant="outline">English</Badge>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-[#E55A3C]/40 via-amber-200 to-green-200" />
          <div className="space-y-4 relative">
            <div className="flex items-start gap-4 pl-0">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FEF3E2] to-[#FFDAB9] flex items-center justify-center flex-shrink-0 shadow-sm">
                <FileJson className="w-7 h-7 text-[#E55A3C]" />
              </div>
              <div className="flex-1 bg-white rounded-xl border border-stone-200 p-4">
                <div className="text-sm font-semibold text-stone-900 mb-1">Config Engine</div>
                <div className="text-xs text-stone-500">Validates form input, generates structured campaign configuration, stores as single source of truth.</div>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Validated</Badge>
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">v1 created</Badge>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4 pl-0">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                <ListChecks className="w-7 h-7 text-amber-600" />
              </div>
              <div className="flex-1 bg-white rounded-xl border border-stone-200 p-4">
                <div className="text-sm font-semibold text-stone-900 mb-2">Execution Plan</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-stone-600">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="font-medium text-green-700">+2</span> ad sets to create
                  </div>
                  <div className="flex items-center gap-2 text-xs text-stone-600">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="font-medium text-amber-700">~3</span> campaign settings to apply
                  </div>
                  <div className="flex items-center gap-2 text-xs text-stone-600">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="font-medium text-blue-700">4</span> platform actions across Meta + Google
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4 pl-0">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Rocket className="w-7 h-7 text-green-600" />
              </div>
              <div className="flex-1 bg-white rounded-xl border border-stone-200 p-4">
                <div className="text-sm font-semibold text-stone-900 mb-1">Publish</div>
                <div className="text-xs text-stone-500">Plan applied asynchronously to connected platforms.</div>
                <div className="flex gap-2 mt-2">
                  <Badge className="bg-green-100 text-green-700 text-xs">Meta — Published</Badge>
                  <Badge className="bg-green-100 text-green-700 text-xs">Google — Published</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'analytics',
    title: 'Step 4: Monitor Unified Analytics',
    subtitle: 'Blended metrics across all networks',
    icon: BarChart3,
    color: 'from-emerald-500 to-emerald-600',
    description: 'View aggregated spend, impressions, clicks, revenue, and calculated metrics like blended CTR and ROAS — all from your local cache.',
    content: (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Total Spend', value: '$4,280', icon: DollarSign, trend: '+12.3%' },
            { label: 'Impressions', value: '184.2K', icon: Eye, trend: '+8.1%' },
            { label: 'Clicks', value: '4,891', icon: MousePointerClick, trend: '+15.2%' },
            { label: 'Blended ROAS', value: '3.42x', icon: TrendingUp, trend: 'CTR: 2.65%' },
          ].map((stat) => (
            <div key={stat.label} className="p-4 rounded-xl bg-white border border-stone-200">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className="w-4 h-4 text-[#E55A3C]" />
                <span className="text-xs text-stone-400">{stat.label}</span>
              </div>
              <div className="text-xl font-semibold text-stone-900">{stat.value}</div>
              <div className="text-xs text-green-600 mt-1">{stat.trend}</div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <div className="text-sm font-medium text-stone-900 mb-3">Platform Breakdown</div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#E55A3C]" />Meta Ads</div>
                <span className="font-medium">$2,340 (54.7%)</span>
              </div>
              <div className="h-2 rounded-full bg-stone-100"><div className="h-full rounded-full bg-gradient-to-r from-[#E55A3C] to-[#F4A574]" style={{ width: '54.7%' }} /></div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500" />Google Ads</div>
                <span className="font-medium">$1,940 (45.3%)</span>
              </div>
              <div className="h-2 rounded-full bg-stone-100"><div className="h-full rounded-full bg-blue-500" style={{ width: '45.3%' }} /></div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'rules',
    title: 'Step 5: Automate Budget Optimization',
    subtitle: 'Rules engine rebalances spend daily',
    icon: Settings2,
    color: 'from-amber-500 to-amber-600',
    description: 'Toggle on cross-channel budget rules. At 11:50 PM UTC daily, our engine shifts budget toward the better-performing platform.',
    content: (
      <div className="space-y-4">
        <div className="p-5 rounded-2xl border-2 border-[#E55A3C]/20 bg-[#E55A3C]/5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FEF3E2] to-[#FFDAB9] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-[#E55A3C]" />
              </div>
              <div>
                <div className="font-semibold text-stone-900">Optimize Cross-Channel Allocations Daily</div>
                <div className="text-xs text-stone-400">Last executed: Jun 21, 2026, 11:50 PM</div>
              </div>
            </div>
            <Badge className="bg-green-100 text-green-700">Active</Badge>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 rounded-xl bg-white border border-stone-200">
              <div className="text-xs text-stone-400">Min Budget</div>
              <div className="font-semibold text-stone-900">$1,000</div>
            </div>
            <div className="p-3 rounded-xl bg-white border border-stone-200">
              <div className="text-xs text-stone-400">Max Budget</div>
              <div className="font-semibold text-stone-900">$10,000</div>
            </div>
            <div className="p-3 rounded-xl bg-white border border-stone-200">
              <div className="text-xs text-stone-400">Shift Amount</div>
              <div className="font-semibold text-stone-900">10% to winner</div>
            </div>
          </div>
          <div className="mt-4 p-4 rounded-xl bg-stone-50 border border-stone-200">
            <div className="text-sm font-medium text-stone-900 mb-2">Logic Applied at Midnight</div>
            <div className="text-sm text-stone-600">
              Meta ROAS 3.8x &gt; Google ROAS 2.5x — difference exceeds 20% threshold.
              Shifted <strong className="text-stone-900">$194</strong> (10%) from Google to Meta for tomorrow&apos;s budget.
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'versions',
    title: 'Step 6: Version History & Rollback',
    subtitle: 'Every change tracked, every version reversible',
    icon: GitBranch,
    color: 'from-indigo-500 to-indigo-600',
    description: 'The campaign config engine automatically versions every change. You can view the full history, see what changed, and rollback to any previous state — all without exposing raw JSON.',
    content: (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Summer Collection Launch — Version Timeline</span>
        </div>

        <div className="space-y-3">
          {[
            {
              version: 3, current: true, user: 'Sarah M.', time: 'Today, 2:15 PM',
              message: 'Increased budget to $6,500 and extended end date',
              changes: [
                { type: 'modified', label: 'totalBudget: $5,000 → $6,500' },
                { type: 'modified', label: 'endDate: 2026-07-15 → 2026-07-31' },
              ],
            },
            {
              version: 2, current: false, user: 'Sarah M.', time: 'Yesterday, 10:30 AM',
              message: 'Updated creative and added UK targeting',
              changes: [
                { type: 'modified', label: 'headline: new creative variant' },
                { type: 'modified', label: 'targeting.countries: added UK' },
              ],
            },
            {
              version: 1, current: false, user: 'system', time: 'Jun 1, 10:00 AM',
              message: 'Campaign created',
              changes: [
                { type: 'added', label: 'Campaign created with 1 ad set, 1 creative' },
              ],
            },
          ].map((v, idx) => (
            <div key={v.version} className={`relative pl-10 ${idx < 2 ? 'pb-3' : ''}`}>
              <div className={`absolute left-[15px] top-2 w-3 h-3 rounded-full border-2 ${
                v.current ? 'bg-indigo-500 border-indigo-500' : 'bg-white border-stone-300'
              }`} />
              {idx < 2 && <div className="absolute left-[19px] top-5 bottom-0 w-0.5 bg-stone-200" />}
              <div className="bg-white rounded-xl border border-stone-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs font-mono">v{v.version}</Badge>
                      {v.current && <Badge className="bg-indigo-100 text-indigo-700 text-xs">Current</Badge>}
                    </div>
                    <p className="font-medium text-stone-900 text-sm">{v.message}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-stone-400">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{v.time}</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-stone-200 inline-block" />{v.user}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {v.changes.map((c, i) => (
                        <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${
                          c.type === 'added' ? 'bg-green-50 text-green-700' :
                          c.type === 'modified' ? 'bg-amber-50 text-amber-700' :
                          'bg-red-50 text-red-700'
                        }`}>
                          {c.type === 'added' ? '+' : c.type === 'modified' ? '~' : '-'} {c.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  {!v.current && (
                    <Button variant="outline" size="sm" className="flex-shrink-0 rounded-full text-xs gap-1">
                      <RotateCcw className="w-3 h-3" />
                      Rollback
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Drift detection active</p>
            <p className="text-sm text-amber-700 mt-1">
              Nova periodically compares internal config against platform state. If the Meta API reports different budget than your last saved version, Nova flags the drift and offers to reconcile.
            </p>
          </div>
        </div>
      </div>
    ),
  },
];

export default function Demo() {
  const [activeStep, setActiveStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const step = steps[activeStep];

  useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(() => {
      setActiveStep((prev) => {
        if (prev >= steps.length - 1) { setAutoPlay(false); return prev; }
        return prev + 1;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [autoPlay]);

  return (
    <div className="min-h-screen bg-stone-50 pt-28 pb-16 px-6 md:px-12 lg:px-24">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <Badge className="bg-[#E55A3C]/10 text-[#E55A3C] mb-4 px-4 py-1.5 text-sm">
            Product Demo
          </Badge>
          <h1 className="text-4xl md:text-5xl font-light text-stone-900 mb-4">
            See Nova in action
          </h1>
          <p className="text-lg text-stone-500 max-w-2xl mx-auto">
            A guided walkthrough of the cross-channel ad command center — from connecting accounts to versioned campaign management.
          </p>
        </div>

        {/* Step Navigation */}
        <div className="flex items-center justify-center gap-2 mb-12 overflow-x-auto pb-2">
          {steps.map((s, i) => (
            <React.Fragment key={s.id}>
              <button
                onClick={() => { setActiveStep(i); setAutoPlay(false); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  i === activeStep
                    ? 'bg-stone-900 text-white shadow-lg'
                    : i < activeStep
                      ? 'bg-green-100 text-green-700'
                      : 'bg-white text-stone-400 border border-stone-200 hover:border-stone-300'
                }`}
              >
                {i < activeStep ? <Check className="w-3.5 h-3.5" /> : <s.icon className="w-3.5 h-3.5" />}
                <span className="hidden md:inline">{s.title.replace('Step', '').trim()}</span>
              </button>
              {i < steps.length - 1 && <div className="w-6 h-px bg-stone-200 hidden md:block" />}
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
          >
            <div className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden">
              {/* Header */}
              <div className={`p-8 bg-gradient-to-r ${step.color} text-white`}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <step.icon className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white/80">{step.subtitle}</div>
                    <h2 className="text-2xl font-semibold">{step.title}</h2>
                  </div>
                </div>
                <p className="text-white/90 max-w-2xl text-lg font-light">{step.description}</p>
              </div>

              {/* Demo Content */}
              <div className="p-8">{step.content}</div>

              {/* Navigation */}
              <div className="flex items-center justify-between p-6 bg-stone-50 border-t border-stone-100">
                <Button
                  variant="outline"
                  onClick={() => { setActiveStep((prev) => Math.max(0, prev - 1)); setAutoPlay(false); }}
                  disabled={activeStep === 0}
                  className="rounded-full"
                >
                  Previous Step
                </Button>

                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setAutoPlay(!autoPlay)}
                    className="rounded-full text-stone-500"
                  >
                    {autoPlay ? <span className="flex items-center gap-2">⏸ Pause</span> : <span className="flex items-center gap-2"><Play className="w-4 h-4" /> Auto-play</span>}
                  </Button>

                  <div className="text-sm text-stone-400">
                    {activeStep + 1} / {steps.length}
                  </div>
                </div>

                {activeStep < steps.length - 1 ? (
                  <Button
                    onClick={() => setActiveStep((prev) => prev + 1)}
                    className="bg-stone-900 hover:bg-stone-800 rounded-full px-6 group"
                  >
                    Next Step
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                ) : (
                  <Button
                    onClick={() => setActiveStep(0)}
                    className="bg-[#E55A3C] hover:bg-[#D14A2E] rounded-full px-6"
                  >
                    <Sparkles className="w-4 h-4 mr-2" /> Replay Demo
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Feature Grid */}
        <div className="mt-16 grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FEF3E2] to-[#FFDAB9] flex items-center justify-center mx-auto mb-4">
              <FileJson className="w-6 h-6 text-[#E55A3C]" />
            </div>
            <h3 className="font-semibold text-stone-900 mb-2">Hidden Config Engine</h3>
            <p className="text-sm text-stone-500">Campaigns stored as internal JSON. Every change is validated, versioned, and reversible — entirely behind the scenes.</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FEF3E2] to-[#FFDAB9] flex items-center justify-center mx-auto mb-4">
              <GitBranch className="w-6 h-6 text-[#E55A3C]" />
            </div>
            <h3 className="font-semibold text-stone-900 mb-2">Version History & Rollback</h3>
            <p className="text-sm text-stone-500">Every change tracked with diffs. One-click rollback to any previous state. Full audit trail.</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FEF3E2] to-[#FFDAB9] flex items-center justify-center mx-auto mb-4">
              <ListChecks className="w-6 h-6 text-[#E55A3C]" />
            </div>
            <h3 className="font-semibold text-stone-900 mb-2">Execution Plans & Drift</h3>
            <p className="text-sm text-stone-500">Before every apply, Nova generates an execution plan. Continuous drift detection catches out-of-sync platform state.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
