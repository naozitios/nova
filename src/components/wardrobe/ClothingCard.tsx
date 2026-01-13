import React from 'react';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClothingItem } from '@/types/clothing';

export interface ClothingCardProps {
  item: ClothingItem;
  onDelete?: (id: string) => void;
  onSelect?: (item: ClothingItem) => void;
  selected?: boolean;
  selectable?: boolean;
}

export default function ClothingCard({
  item,
  onDelete,
  onSelect,
  selected = false,
  selectable = false,
}: ClothingCardProps) {
  const categoryColors = {
    tops: 'bg-rose-50 text-rose-700',
    bottoms: 'bg-blue-50 text-blue-700',
    dresses: 'bg-purple-50 text-purple-700',
    outerwear: 'bg-amber-50 text-amber-700',
    shoes: 'bg-emerald-50 text-emerald-700',
    accessories: 'bg-pink-50 text-pink-700'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ y: -4 }}
      onClick={() => selectable && onSelect?.(item)}
      className={`group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 ${
        selectable ? 'cursor-pointer' : ''
      } ${selected ? 'ring-2 ring-[#C9A484] ring-offset-2' : ''}`}
    >
      <div className="aspect-square overflow-hidden bg-stone-100">
        <img
          src={item.image_url}
          alt={item.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-stone-900 truncate">{item.name}</h3>
            {item.brand && (
              <p className="text-sm text-stone-500 truncate">{item.brand}</p>
            )}
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${categoryColors[item.category]}`}>
            {item.category}
          </span>
        </div>
        
        {item.color && (
          <div className="mt-2 flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full border border-stone-200"
              style={{ backgroundColor: item.color.toLowerCase() }}
            />
            <span className="text-xs text-stone-500">{item.color}</span>
          </div>
        )}
      </div>

      {onDelete && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 bg-white/90 backdrop-blur-sm hover:bg-red-50 hover:text-red-600"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}

      {selected && (
        <div className="absolute top-2 left-2">
          <div className="w-6 h-6 bg-[#C9A484] rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      )}
    </motion.div>
  );
}