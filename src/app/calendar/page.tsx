/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Image from 'next/image';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Shirt } from 'lucide-react';
import { nova } from '@/api/novaClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isSameDay, startOfWeek, addDays } from 'date-fns';
import OutfitCalendar from '@/components/calendar/OutfitCalendar';
import OutfitPlanner from '@/components/calendar/OutfitPlanner';

export default function Calendar() {
  const [selectedDate, setSelectedDate] = useState(null);
  const queryClient = useQueryClient();

  const { data: clothingItems = [] as any[] } = useQuery({
    queryKey: ['clothing'],
    queryFn: () => nova.entities.ClothingItem.list()
  });

  const { data: plannedOutfits = [] as any[] } = useQuery({
    queryKey: ['outfits'],
    queryFn: () => nova.entities.PlannedOutfit.list('-date')
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => nova.entities.PlannedOutfit.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['outfits'] })
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => nova.entities.PlannedOutfit.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['outfits'] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id: any) => nova.entities.PlannedOutfit.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['outfits'] })
  });

  const handleDayClick = (date: any) => {
    setSelectedDate(date);
  };

  const handleSaveOutfit = (data: any) => {
    const existing = plannedOutfits.find(o => o.date === data.date);
    if (existing) {
      updateMutation.mutate({ id: existing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getExistingOutfit = () => {
    if (!selectedDate) return null;
    return plannedOutfits.find(o => isSameDay(new Date(o.date), selectedDate));
  };

  // Get upcoming outfits for the week
  const getUpcomingOutfits = () => {
    const today = new Date();
    const weekStart = startOfWeek(today);
    const weekDays = Array(7).fill(0).map((_, i) => addDays(weekStart, i));
    
    return weekDays.map(day => ({
      date: day,
      outfit: plannedOutfits.find(o => isSameDay(new Date(o.date), day))
    })).filter(d => d.date >= today);
  };

  const upcomingOutfits = getUpcomingOutfits();

  return (
    <div className="min-h-screen bg-stone-50 py-20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-900">Outfit Calendar</h1>
          <p className="text-stone-500 mt-1">Plan your looks ahead of time</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <OutfitCalendar
              plannedOutfits={plannedOutfits}
              clothingItems={clothingItems}
              onDayClick={handleDayClick}
            />
          </div>

          {/* Upcoming */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-[#C9A484]" />
                This Week
              </h3>

              <div className="space-y-3">
                {upcomingOutfits.map(({ date, outfit }) => {
                  const outfitItems = outfit?.clothing_items
                    ?.map((id: any) => clothingItems.find(c => c.id === id))
                    .filter(Boolean) || [];

                  return (
                    <motion.button
                      key={date.toISOString()}
                      whileHover={{ x: 4 }}
                      onClick={() => handleDayClick(date)}
                      className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-stone-50 transition-colors text-left"
                    >
                      <div className="text-center min-w-[3rem]">
                        <div className="text-xs text-stone-400 uppercase">
                          {format(date, 'EEE')}
                        </div>
                        <div className="text-xl font-semibold text-stone-900">
                          {format(date, 'd')}
                        </div>
                      </div>

                      {outfit ? (
                        <div className="flex-1 flex items-center gap-3">
                          <div className="flex -space-x-2">
                            {outfitItems.slice(0, 3).map((item: any, idx: any) => (
                              <div
                                key={idx}
                                className="w-10 h-10 rounded-lg border-2 border-white overflow-hidden"
                              >
                                <Image
                                  src={item.image_url}
                                  alt=""
                                  width={40}
                                  height={40}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-stone-900 truncate">
                              {outfit.occasion || `${outfitItems.length} items`}
                            </p>
                            <p className="text-xs text-stone-500">
                              {outfitItems.map((i: any) => i.category).filter((v: any, i: any, a: any) => a.indexOf(v) === i).join(', ')}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center gap-3 text-stone-400">
                          <div className="w-10 h-10 rounded-lg border-2 border-dashed border-stone-200 flex items-center justify-center">
                            <Shirt className="w-5 h-5" />
                          </div>
                          <span className="text-sm">No outfit planned</span>
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Stats */}
            <div className="bg-gradient-to-br from-stone-900 to-stone-800 rounded-3xl p-6 text-white">
              <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-3xl font-bold text-[#C9A484]">
                    {clothingItems.length}
                  </div>
                  <div className="text-sm text-stone-400">Items</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-[#C9A484]">
                    {plannedOutfits.length}
                  </div>
                  <div className="text-sm text-stone-400">Outfits Planned</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Planner Modal */}
      <AnimatePresence>
        {selectedDate && (
          <OutfitPlanner
            date={selectedDate}
            clothingItems={clothingItems}
            existingOutfit={getExistingOutfit()}
            onSave={handleSaveOutfit}
            onDelete={(id: any) => deleteMutation.mutate(id)}
            onClose={() => setSelectedDate(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}