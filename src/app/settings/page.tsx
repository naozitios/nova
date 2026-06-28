'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Link2, Link2Off, Settings2, Clock } from 'lucide-react';
import { adClient } from '@/api/adClient';
import { AdAccount, BudgetRule } from '@/types/advertising';

function AccountCard({ account }: { account: AdAccount }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-stone-100 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
          account.platform === 'meta' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'
        }`}>
          {account.platform === 'meta' ? 'M' : 'G'}
        </div>
        <div>
          <h4 className="font-medium text-stone-900">{account.name}</h4>
          <p className="text-sm text-stone-400">{account.accountId}</p>
        </div>
      </div>
      <Badge className={account.status === 'connected' ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'}>
        {account.status === 'connected' ? <><Link2 className="w-3 h-3 mr-1 inline" /> Connected</> : <><Link2Off className="w-3 h-3 mr-1 inline" /> Disconnected</>}
      </Badge>
    </div>
  );
}

export default function Settings() {
  const queryClient = useQueryClient();

  const { data: accounts = [] } = useQuery<AdAccount[]>({
    queryKey: ['accounts'],
    queryFn: () => adClient.accounts.list(),
  });

  const { data: rules = [] } = useQuery<BudgetRule[]>({
    queryKey: ['rules'],
    queryFn: () => adClient.rules.list(),
  });

  const updateRuleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BudgetRule> }) => adClient.rules.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rules'] }),
  });

  const toggleRule = (rule: BudgetRule) => {
    updateRuleMutation.mutate({ id: rule.id, data: { enabled: !rule.enabled } });
  };

  return (
    <div className="min-h-screen bg-stone-50 pt-28 pb-16 px-6 md:px-12 lg:px-24">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-900">Settings</h1>
          <p className="text-stone-500 mt-1">Manage your ad accounts and automation rules</p>
        </div>

        {/* Connected Accounts */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-stone-900">Connected Accounts</h2>
              <p className="text-sm text-stone-400">Manage your ad platform integrations</p>
            </div>
            <Button variant="outline" className="rounded-full gap-2">
              <Link2 className="w-4 h-4" /> Connect Account
            </Button>
          </div>
          <div className="space-y-3">
            {accounts.map(account => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        </motion.section>

        {/* Budget Rules */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-stone-900">Budget Optimization Rules</h2>
              <p className="text-sm text-stone-400">Automate cross-channel budget reallocation</p>
            </div>
          </div>

          <div className="space-y-4">
            {rules.map(rule => (
              <div key={rule.id} className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FEF3E2] to-[#FFDAB9] flex items-center justify-center">
                      <Settings2 className="w-5 h-5 text-[#E55A3C]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-stone-900">{rule.name}</h3>
                      {rule.lastExecuted && (
                        <p className="text-xs text-stone-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" /> Last executed: {new Date(rule.lastExecuted).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <Switch checked={rule.enabled} onCheckedChange={() => toggleRule(rule)} />
                </div>

                {rule.enabled && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-stone-100">
                    <div>
                      <div className="text-xs text-stone-400">Min Budget</div>
                      <div className="font-medium text-stone-900">${rule.minBudget.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-stone-400">Max Budget</div>
                      <div className="font-medium text-stone-900">${rule.maxBudget.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-stone-400">ROAS Threshold</div>
                      <div className="font-medium text-stone-900">{(rule.roasThreshold * 100).toFixed(0)}% difference</div>
                    </div>
                    <div>
                      <div className="text-xs text-stone-400">Shift %</div>
                      <div className="font-medium text-stone-900">{(rule.shiftPercentage * 100).toFixed(0)}% to winner</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Sync Schedule */}
          <div className="mt-8 bg-white rounded-3xl p-6 shadow-sm border border-stone-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FEF3E2] to-[#FFDAB9] flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#E55A3C]" />
              </div>
              <div>
                <h3 className="font-semibold text-stone-900">Data Sync Schedule</h3>
                <p className="text-xs text-stone-400">Automatic metrics refresh from ad networks</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-stone-600">Active sync every 3 hours</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-stone-600">Budget rules run at 11:50 PM UTC</span>
              </div>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
