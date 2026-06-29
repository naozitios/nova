'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Activity, Lightbulb, ListChecks } from 'lucide-react';
import AccountHealth from '@/components/optimization/AccountHealth';
import OptimizationCopilot from '@/components/optimization/OptimizationCopilot';
import ActionCenter from '@/components/optimization/ActionCenter';

export default function OptimizationWorkspace() {
  return (
    <div className="min-h-screen bg-stone-50 pt-28 pb-16 px-6 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FEF3E2] to-[#FFDAB9] flex items-center justify-center">
              <Activity className="w-5 h-5 text-[#E55A3C]" />
            </div>
            <h1 className="text-3xl font-bold text-stone-900">Optimization Workspace</h1>
          </div>
          <p className="text-stone-500 mt-1 ml-13">
            Monitor account health, identify optimization opportunities, and execute improvements.
          </p>
        </motion.div>

        <Tabs defaultValue="health" className="w-full">
          <TabsList className="mb-8 bg-stone-100 rounded-2xl p-1.5 h-auto">
            <TabsTrigger value="health" className="rounded-xl px-5 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-stone-900 text-stone-500 gap-2">
              <Activity className="w-4 h-4" />
              Account Health
            </TabsTrigger>
            <TabsTrigger value="copilot" className="rounded-xl px-5 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-stone-900 text-stone-500 gap-2">
              <Lightbulb className="w-4 h-4" />
              Optimization Copilot
            </TabsTrigger>
            <TabsTrigger value="actions" className="rounded-xl px-5 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-stone-900 text-stone-500 gap-2">
              <ListChecks className="w-4 h-4" />
              Action Center
            </TabsTrigger>
          </TabsList>

          <TabsContent value="health">
            <AccountHealth />
          </TabsContent>
          <TabsContent value="copilot">
            <OptimizationCopilot />
          </TabsContent>
          <TabsContent value="actions">
            <ActionCenter />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
