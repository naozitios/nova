/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';
import Image from 'next/image';
import { PlannedOutfit, ClothingItem } from '@/types/clothing';

export interface OutfitCalendarProps {
  plannedOutfits: PlannedOutfit[];
  clothingItems: ClothingItem[];
  onDayClick: (date: Date) => void;
}

export default function OutfitCalendar({ plannedOutfits, clothingItems, onDayClick }: OutfitCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  const startDay = monthStart.getDay();
  const paddingDays = Array(startDay).fill(null);

  const getOutfitForDay = (date: any) => {
    return plannedOutfits.find((o: any) => isSameDay(new Date(o.date), date));
  };

  const getOutfitImages = (outfit: any) => {
    if (!outfit?.clothing_items) return [];
    return outfit.clothing_items
      .map((id: any) => clothingItems.find((c: any) => c.id === id))
      .filter(Boolean)
      .slice(0, 3);
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-stone-900">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs font-medium text-stone-400 py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {paddingDays.map((_, idx) => (
          <div key={`pad-${idx}`} className="aspect-square" />
        ))}
        
        {days.map((day: any) => {
          const outfit = getOutfitForDay(day);
          const outfitImages = getOutfitImages(outfit);
          const isToday = isSameDay(day, new Date());
          
          return (
            <motion.button
              key={day.toISOString()}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onDayClick(day)}
              className={`aspect-square rounded-xl p-1 flex flex-col items-center justify-center relative transition-all ${
                isToday
                  ? 'bg-[#C9A484] text-white'
                  : outfit
                  ? 'bg-stone-100 hover:bg-stone-200'
                  : 'hover:bg-stone-50'
              }`}
            >
              <span className={`text-sm font-medium ${isToday ? 'text-white' : 'text-stone-700'}`}>
                {format(day, 'd')}
              </span>
              
              {outfitImages.length > 0 && (
                <div className="flex -space-x-1 mt-1">
                  {outfitImages.map((item: any, idx: any) => (
                    <div
                      key={idx}
                      className="w-4 h-4 rounded-full border border-white overflow-hidden"
                    >
                      <Image
                        src={item.image_url}
                        alt=""
                        width={16}
                        height={16}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
              
              {!outfit && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <Plus className="w-4 h-4 text-stone-400" />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}