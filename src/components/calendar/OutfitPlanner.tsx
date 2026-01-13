/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Check, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import ClothingCard from '@/components/wardrobe/ClothingCard';
import CategoryFilter from '@/components/wardrobe/CategoryFilter';

export default function OutfitPlanner({ date, clothingItems, existingOutfit, onSave, onClose, onDelete }: { date: any, clothingItems: any, existingOutfit: any, onSave: any, onClose: any, onDelete: any }) {
  const [selectedItems, setSelectedItems] = useState(existingOutfit?.clothing_items || []);
  const [occasion, setOccasion] = useState(existingOutfit?.occasion || '');
  const [category, setCategory] = useState('all');

  const filteredItems = clothingItems.filter(
    (item: any) => category === 'all' || item.category === category
  );

  const toggleItem = (item: any) => {
    setSelectedItems((prev: any) =>
      prev.includes(item.id)
        ? prev.filter((id: any) => id !== item.id)
        : [...prev, item.id]
    );
  };

  const handleSave = () => {
    onSave({
      date: format(date, 'yyyy-MM-dd'),
      clothing_items: selectedItems,
      occasion
    });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="p-6 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#C9A484]/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[#C9A484]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-stone-900">Plan Outfit</h2>
              <p className="text-sm text-stone-500">{format(date, 'EEEE, MMMM d, yyyy')}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 flex-1 overflow-hidden flex flex-col gap-4">
          <Input
            placeholder="What's the occasion? (e.g., Work meeting, Date night)"
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            className="rounded-xl"
          />

          <CategoryFilter selected={category} onSelect={setCategory} />

          {selectedItems.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <span className="text-sm text-stone-500">Selected:</span>
              {selectedItems.map((id: any) => {
                const item = clothingItems.find((c: any) => c.id === id);
                return item ? (
                  <span
                    key={id}
                    className="text-sm bg-stone-100 px-2 py-1 rounded-full flex items-center gap-1"
                  >
                    {item.name}
                    <button onClick={() => toggleItem(item)}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ) : null;
              })}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {filteredItems.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredItems.map((item: any) => (
                  <ClothingCard
                    key={item.id}
                    item={item}
                    selectable
                    selected={selectedItems.includes(item.id)}
                    onSelect={toggleItem}
                    onDelete={() => {}}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-stone-400">
                <p>No items in this category</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-stone-100 flex gap-3">
          {existingOutfit && (
            <Button
              variant="outline"
              className="text-red-600 hover:bg-red-50"
              onClick={() => {
                onDelete(existingOutfit.id);
                onClose();
              }}
            >
              Remove Outfit
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-stone-900 hover:bg-stone-800 gap-2"
            disabled={selectedItems.length === 0}
            onClick={handleSave}
          >
            <Check className="w-4 h-4" />
            Save Outfit
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}