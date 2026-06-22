'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Link2, Upload, Rocket, Activity, BarChart3,
  DollarSign, Eye, MousePointerClick, TrendingUp, Play, Target, Settings2, Sparkles
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
    subtitle: 'One form → Meta + Google simultaneously',
    icon: Rocket,
    color: 'from-[#E55A3C] to-[#F4A574]',
    description: 'A single wizard-style form collects campaign settings, targeting, and creatives. We assemble and fork platform-specific API payloads.',
    content: (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
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
        <div className="flex items-center gap-4 p-4 rounded-xl bg-stone-50">
          <div className="flex-1 text-center p-3 rounded-lg bg-blue-50 border border-blue-100">
            <div className="text-sm font-medium text-blue-700">Meta Payload</div>
            <div className="text-xs text-blue-500 mt-1">Campaign → Ad Set → Ad</div>
          </div>
          <ArrowRight className="w-5 h-5 text-stone-400" />
          <div className="flex-1 text-center p-3 rounded-lg bg-red-50 border border-red-100">
            <div className="text-sm font-medium text-red-700">Google Payload</div>
            <div className="text-xs text-red-500 mt-1">PMax → Asset Group</div>
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
            A guided walkthrough of the cross-channel ad command center — from connecting accounts to automated budget optimization.
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
              <Target className="w-6 h-6 text-[#E55A3C]" />
            </div>
            <h3 className="font-semibold text-stone-900 mb-2">FR-2.1 Global Asset Repository</h3>
            <p className="text-sm text-stone-500">Centralized media manager with background validation for Meta & Google format requirements.</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FEF3E2] to-[#FFDAB9] flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-6 h-6 text-[#E55A3C]" />
            </div>
            <h3 className="font-semibold text-stone-900 mb-2">FR-3.2 Metric Normalization</h3>
            <p className="text-sm text-stone-500">Normalized spend, impressions, clicks, and revenue from Meta + Google into unified columns.</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FEF3E2] to-[#FFDAB9] flex items-center justify-center mx-auto mb-4">
              <Activity className="w-6 h-6 text-[#E55A3C]" />
            </div>
            <h3 className="font-semibold text-stone-900 mb-2">FR-4.2 Daily Budget Pacing</h3>
            <p className="text-sm text-stone-500">Auto-shift 10% of budget to the higher-ROAS platform when performance gap exceeds 20%.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
