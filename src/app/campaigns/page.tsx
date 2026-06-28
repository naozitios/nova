'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, MoreVertical, Play, Pause, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { adClient } from '@/api/adClient';
import { Campaign } from '@/types/advertising';
import { campaignStore, ensureSeeded } from '@/lib/campaign-engine';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-amber-100 text-amber-700',
  draft: 'bg-stone-100 text-stone-600',
  completed: 'bg-blue-100 text-blue-700',
  failed: 'bg-red-100 text-red-700',
};

export default function Campaigns() {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const mock = await adClient.campaigns.list();
      ensureSeeded();
      const stored = campaignStore.list();
      const storedCamps: Campaign[] = stored.map(e => ({
        id: e.id,
        name: e.config.name,
        platform: e.config.platform[0] || 'meta',
        status: 'active' as const,
        objective: e.config.objective,
        totalBudget: e.config.totalBudget,
        startDate: e.config.startDate,
        endDate: e.config.endDate,
        adGroups: e.config.adSets.map(a => ({
          id: `${e.id}-${a.name}`,
          name: a.name,
          platform: e.config.platform[0] || 'meta',
          targeting: a.targeting,
          bidAmount: a.bidAmount,
          creatives: a.creatives.map(c => ({
            id: `${e.id}-cr`,
            name: c.headline.slice(0, 20),
            platform: e.config.platform[0] || 'meta',
            headline: c.headline,
            bodyText: c.bodyText,
            destinationUrl: c.destinationUrl,
            mediaUrl: c.mediaUrl,
            mediaType: c.mediaType,
            status: 'approved' as const,
          })),
        })),
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      }));
      const existingIds = new Set(mock.map(c => c.id));
      const merged = [...mock];
      for (const sc of storedCamps) {
        if (!existingIds.has(sc.id)) merged.push(sc);
      }
      return merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adClient.campaigns.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Campaign> }) => adClient.campaigns.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });

  const filtered = campaigns.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.platform.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-stone-50 pt-28 pb-16 px-6 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-stone-900">Campaigns</h1>
            <p className="text-stone-500 mt-1">{campaigns.length} campaigns across all platforms</p>
          </div>
          <Link href="/campaigns/new">
            <Button className="bg-[#E55A3C] hover:bg-[#D14A2E] gap-2 rounded-full px-6">
              <Plus className="w-5 h-5" />
              New Campaign
            </Button>
          </Link>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <Input
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-12 h-12 rounded-full bg-white border-stone-200"
          />
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 animate-pulse h-24" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((campaign, i) => (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <Link href={`/campaigns/${campaign.id}`} className="flex-1">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                        campaign.platform === 'meta' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {campaign.platform === 'meta' ? 'M' : 'G'}
                      </div>
                      <div>
                        <h3 className="font-semibold text-stone-900">{campaign.name}</h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-stone-500">
                          <span className="capitalize">{campaign.platform}</span>
                          <span>•</span>
                          <span>{campaign.objective.replace(/_/g, ' ').toLowerCase()}</span>
                          <span>•</span>
                          <span>${campaign.totalBudget.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </Link>

                  <div className="flex items-center gap-3">
                    <Badge className={`${statusColors[campaign.status]} capitalize`}>
                      {campaign.status}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-stone-400">
                          <MoreVertical className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        {campaign.status === 'active' ? (
                          <DropdownMenuItem onClick={() => updateMutation.mutate({ id: campaign.id, data: { status: 'paused' } })}>
                            <Pause className="w-4 h-4 mr-2" /> Pause
                          </DropdownMenuItem>
                        ) : campaign.status === 'paused' ? (
                          <DropdownMenuItem onClick={() => updateMutation.mutate({ id: campaign.id, data: { status: 'active' } })}>
                            <Play className="w-4 h-4 mr-2" /> Resume
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem className="text-red-600" onClick={() => deleteMutation.mutate(campaign.id)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
