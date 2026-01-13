/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { nova } from '@/api/novaClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ClothingCard from '@/components/wardrobe/ClothingCard';
import CategoryFilter from '@/components/wardrobe/CategoryFilter';
import CameraCapture from '@/components/capture/CameraCapture';

export default function Wardrobe() {
  const [showCapture, setShowCapture] = useState(false);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: items = [] as any[], isLoading } = useQuery({
    queryKey: ['clothing'],
    queryFn: () => nova.entities.ClothingItem.list('-created_date')
  });

  const createMutation = useMutation({
    mutationFn: (items: any) => nova.entities.ClothingItem.bulkCreate(items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clothing'] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id: any) => nova.entities.ClothingItem.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clothing'] })
  });

  const handleCapture = (detectedItems: any) => {
    createMutation.mutate(detectedItems);
  };

  const filteredItems = items.filter(item => {
    const matchesCategory = category === 'all' || item.category === category;
    const matchesSearch = !search || 
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.brand?.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-stone-50 py-20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-stone-900">My Wardrobe</h1>
            <p className="text-stone-500 mt-1">{items.length} pieces in your collection</p>
          </div>
          
          <Button
            onClick={() => setShowCapture(true)}
            className="bg-stone-900 hover:bg-stone-800 gap-2 rounded-full px-6"
          >
            <Plus className="w-5 h-5" />
            Add Clothes
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <Input
            placeholder="Search your wardrobe..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-12 h-12 rounded-full bg-white border-stone-200"
          />
        </div>

        {/* Categories */}
        <div className="mb-8">
          <CategoryFilter selected={category} onSelect={setCategory} />
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array(8).fill(0).map((_, i) => (
              <div key={i} className="aspect-square bg-stone-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredItems.length > 0 ? (
          <motion.div 
            layout
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
          >
            <AnimatePresence>
              {filteredItems.map(item => (
                <ClothingCard
                  key={item.id}
                  item={item}
                  onDelete={(id: any) => deleteMutation.mutate(id)}
                  selectable={false}
                  onSelect={() => {}}
                  selected={false}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div className="w-20 h-20 rounded-full bg-stone-100 flex items-center justify-center mb-4">
              <Sparkles className="w-10 h-10 text-stone-300" />
            </div>
            <h3 className="text-xl font-medium text-stone-900 mb-2">
              {search || category !== 'all' ? 'No items found' : 'Your wardrobe is empty'}
            </h3>
            <p className="text-stone-500 mb-6 text-center max-w-sm">
              {search || category !== 'all' 
                ? 'Try adjusting your filters'
                : 'Start building your digital closet by adding your first piece'}
            </p>
            {!search && category === 'all' && (
              <Button
                onClick={() => setShowCapture(true)}
                className="bg-[#C9A484] hover:bg-[#b8936f] gap-2 rounded-full"
              >
                <Plus className="w-5 h-5" />
                Add Your First Item
              </Button>
            )}
          </motion.div>
        )}
      </div>

      {/* Camera Modal */}
      <AnimatePresence>
        {showCapture && (
          <CameraCapture
            onCapture={handleCapture}
            onClose={() => setShowCapture(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}