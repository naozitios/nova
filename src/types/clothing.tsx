// types/clothing.ts
export interface ClothingItem {
  id: string;
  name: string;
  category: 'tops' | 'bottoms' | 'dresses' | 'outerwear' | 'shoes' | 'accessories';
  color?: string;
  brand?: string | null;
  image_url: string;
}

export interface ClothingItem {
  id: string;
  name: string;
  image_url: string;
}

export interface PlannedOutfit {
  id: string;
  date: string;
  clothing_items: string[];
}