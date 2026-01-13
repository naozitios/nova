import React from 'react';
import { motion } from 'framer-motion';
import { Shirt, CircleDot, Sparkles, CloudSun, Footprints, Watch } from 'lucide-react';

const categories = [
  { id: 'all', label: 'All', icon: Sparkles },
  { id: 'tops', label: 'Tops', icon: Shirt },
  { id: 'bottoms', label: 'Bottoms', icon: CircleDot },
  { id: 'dresses', label: 'Dresses', icon: Sparkles },
  { id: 'outerwear', label: 'Outerwear', icon: CloudSun },
  { id: 'shoes', label: 'Shoes', icon: Footprints },
  { id: 'accessories', label: 'Accessories', icon: Watch },
];

export default function CategoryFilter({ selected, onSelect }: { selected: any, onSelect: any }) { // eslint-disable-line @typescript-eslint/no-explicit-any
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {categories.map((cat) => {
        const Icon = cat.icon;
        const isSelected = selected === cat.id;
        
        return (
          <motion.button
            key={cat.id}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(cat.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full whitespace-nowrap transition-all duration-300 ${
              isSelected
                ? 'bg-stone-900 text-white shadow-lg'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="text-sm font-medium">{cat.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}