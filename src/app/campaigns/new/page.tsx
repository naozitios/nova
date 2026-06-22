'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Loader2, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { adClient } from '@/api/adClient';
import { Platform } from '@/types/advertising';

const steps = ['Campaign Settings', 'Targeting', 'Creative', 'Review & Publish'];

export default function NewCampaign() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState<{ meta: { success: boolean; errors: string | null }; google: { success: boolean; errors: string | null } } | null>(null);

  const [form, setForm] = useState({
    name: '',
    platform: [] as Platform[],
    objective: 'CONVERSIONS',
    totalBudget: '',
    startDate: '',
    endDate: '',
    countries: '',
    ageMin: '18',
    ageMax: '65',
    languages: '',
    headline: '',
    bodyText: '',
    destinationUrl: '',
    mediaUrl: '',
  });

  const update = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const canProceed = () => {
    if (step === 0) return form.name && form.platform.length > 0 && form.totalBudget && form.startDate && form.endDate;
    if (step === 1) return form.countries && form.languages;
    if (step === 2) return form.headline && form.bodyText && form.destinationUrl;
    return true;
  };

  const handlePublish = async () => {
    setPublishing(true);
    const res = await adClient.publishCampaign(form);
    setResults(res);
    setPublishing(false);
    if (res.meta.success && res.google.success) {
      setTimeout(() => router.push('/campaigns'), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 pt-28 pb-16 px-6 md:px-12 lg:px-24">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-stone-500 hover:text-stone-900 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to campaigns
        </button>

        <div className="mb-10">
          <h1 className="text-3xl font-bold text-stone-900 mb-2">New Cross-Channel Campaign</h1>
          <p className="text-stone-500">Launch to Meta and Google simultaneously</p>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2 mb-10">
          {steps.map((s, i) => (
            <React.Fragment key={i}>
              <div className={`flex items-center gap-2 ${i <= step ? 'text-[#E55A3C]' : 'text-stone-300'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  i < step ? 'bg-[#E55A3C] text-white' : i === step ? 'bg-[#E55A3C]/10 text-[#E55A3C] border border-[#E55A3C]' : 'bg-stone-100 text-stone-400'
                }`}>
                  {i < step ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className="text-sm font-medium hidden md:inline">{s}</span>
              </div>
              {i < steps.length - 1 && <div className={`flex-1 h-px ${i < step ? 'bg-[#E55A3C]' : 'bg-stone-200'}`} />}
            </React.Fragment>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white rounded-3xl p-8 shadow-sm border border-stone-100"
          >
            {results ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-semibold text-stone-900 mb-2">Campaign Published!</h2>
                <p className="text-stone-500 mb-6">Redirecting to campaign list...</p>
                <div className="space-y-3 text-left max-w-sm mx-auto">
                  {Object.entries(results).map(([platform, res]) => (
                    <div key={platform} className={`p-4 rounded-xl ${res.success ? 'bg-green-50' : 'bg-red-50'}`}>
                      <div className="flex items-center gap-2 font-medium capitalize mb-1">
                        {res.success ? <Check className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
                        {platform} {res.success ? '— Published' : '— Failed'}
                      </div>
                      {res.errors && <p className="text-sm text-red-600 ml-6">{res.errors}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {step === 0 && (
                  <div className="space-y-6">
                    <div>
                      <Label htmlFor="name">Campaign Name</Label>
                      <Input id="name" placeholder="e.g. Summer Collection Launch" value={form.name} onChange={e => update('name', e.target.value)} className="h-11 mt-1.5" />
                    </div>
                    <div>
                      <Label>Platforms</Label>
                      <div className="flex gap-3 mt-1.5">
                        {(['meta', 'google'] as Platform[]).map(p => (
                          <button
                            key={p}
                            onClick={() => {
                              const next = form.platform.includes(p) ? form.platform.filter(x => x !== p) : [...form.platform, p];
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
                    <div className="grid md:grid-cols-2 gap-4">
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
                        <Input type="number" placeholder="5000" value={form.totalBudget} onChange={e => update('totalBudget', e.target.value)} className="h-11 mt-1.5" />
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
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-6">
                    <div>
                      <Label>Target Countries</Label>
                      <Input placeholder="e.g. US, CA, UK" value={form.countries} onChange={e => update('countries', e.target.value)} className="h-11 mt-1.5" />
                      <p className="text-xs text-stone-400 mt-1">Comma-separated country codes</p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
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
                      <Input placeholder="e.g. en, es, fr" value={form.languages} onChange={e => update('languages', e.target.value)} className="h-11 mt-1.5" />
                      <p className="text-xs text-stone-400 mt-1">Comma-separated language codes</p>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-6">
                    <div>
                      <Label>Primary Headline</Label>
                      <Input placeholder="e.g. Summer Sale — 50% Off" value={form.headline} onChange={e => update('headline', e.target.value)} className="h-11 mt-1.5" />
                    </div>
                    <div>
                      <Label>Body Text</Label>
                      <Textarea placeholder="Describe your offer..." value={form.bodyText} onChange={e => update('bodyText', e.target.value)} className="mt-1.5" rows={3} />
                    </div>
                    <div>
                      <Label>Destination URL</Label>
                      <Input placeholder="https://example.com/landing" value={form.destinationUrl} onChange={e => update('destinationUrl', e.target.value)} className="h-11 mt-1.5" />
                    </div>
                    <div>
                      <Label>Media URL (Image)</Label>
                      <Input placeholder="https://images.unsplash.com/photo-..." value={form.mediaUrl} onChange={e => update('mediaUrl', e.target.value)} className="h-11 mt-1.5" />
                    </div>
                    {form.mediaUrl && (
                      <div className="rounded-2xl overflow-hidden border border-stone-200">
                        <img src={form.mediaUrl} alt="Preview" className="w-full h-48 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                    )}
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    <div className="bg-stone-50 rounded-2xl p-6 space-y-4">
                      <h3 className="font-semibold text-stone-900">Campaign Summary</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><span className="text-stone-400">Name</span><p className="font-medium text-stone-900">{form.name}</p></div>
                        <div><span className="text-stone-400">Budget</span><p className="font-medium text-stone-900">${form.totalBudget}</p></div>
                        <div><span className="text-stone-400">Platforms</span><p className="font-medium text-stone-900 capitalize">{form.platform.join(' + ')}</p></div>
                        <div><span className="text-stone-400">Objective</span><p className="font-medium text-stone-900">{form.objective.replace(/_/g, ' ').toLowerCase()}</p></div>
                        <div><span className="text-stone-400">Targeting</span><p className="font-medium text-stone-900">{form.countries}, ages {form.ageMin}-{form.ageMax}</p></div>
                        <div><span className="text-stone-400">Headline</span><p className="font-medium text-stone-900">{form.headline}</p></div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                      <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">What happens next?</p>
                        <p className="text-sm text-amber-700 mt-1">Nova will assemble platform-specific payloads and publish asynchronously to {form.platform.join(' and ')}. You&apos;ll see the results instantly.</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between mt-8 pt-6 border-t border-stone-100">
                  <Button variant="outline" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} className="rounded-full">
                    Back
                  </Button>
                  {step < 3 ? (
                    <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed()} className="bg-[#E55A3C] hover:bg-[#D14A2E] rounded-full px-8 group">
                      Continue
                      <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  ) : (
                    <Button onClick={handlePublish} disabled={publishing} className="bg-green-600 hover:bg-green-700 rounded-full px-8">
                      {publishing ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Publishing...</>
                      ) : (
                        <><Check className="w-4 h-4 mr-2" /> Publish Campaign</>
                      )}
                    </Button>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
