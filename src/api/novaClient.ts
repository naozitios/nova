// This is a placeholder for the nova API client.
import { ClothingItem, PlannedOutfit } from '@/types/clothing';

let mockClothingItems: ClothingItem[] = [
  {
    id: 'ci1',
    name: 'Blue T-Shirt',
    category: 'tops',
    image_url:
      'https://static.zara.net/assets/public/2bf5/db80/636e4fc6b678/f61cc0785401/02350755403-e1/02350755403-e1.jpg?ts=1742477959623&w=2240',
    color: 'blue',
  },
  {
    id: 'ci2',
    name: 'Red Hoodie',
    category: 'tops',
    image_url:
      'https://static.zara.net/assets/public/1dfd/5f94/5d2e4d0fb25a/b7146298dacb/04935627600-e1/04935627600-e1.jpg?ts=1758212645082&w=3024',
    color: 'red',
  },
  {
    id: 'ci3',
    name: 'Denim Jeans',
    category: 'bottoms',
    image_url:
      'https://static.zara.net/assets/public/bfc3/a61a/28cb435a9934/a04928f3ac43/08727242400-e1/08727242400-e1.jpg?ts=1753291650315&w=2240',
    color: 'blue',
  },
  {
    id: 'ci4',
    name: 'Black Skirt',
    category: 'bottoms',
    image_url:
      'https://static.zara.net/assets/public/7de3/d236/54444b14abce/a2d2d44ddb11/08338537800-e1/08338537800-e1.jpg?ts=1739349367394&w=2240',
    color: 'black',
  },
  {
    id: 'ci5',
    name: 'Summer Dress',
    category: 'dresses',
    image_url:
      'https://static.zara.net/assets/public/7f3d/2745/ecba4b2790f3/b13245127b5c/04772306250-e1/04772306250-e1.jpg?ts=1767873075841&w=2240',
    color: 'white',
  },
  {
    id: 'ci6',
    name: 'Flowing mini dress',
    category: 'dresses',
    image_url:
      'https://static.zara.net/assets/public/f664/670a/83e94f23925f/d4ca495089b2/06929185406-e1/06929185406-e1.jpg?ts=1749738597852&w=3024',
    color: 'purple',
  },
  {
    id: 'ci7',
    name: 'Leather dress',
    category: 'dresses',
    image_url:
      'https://static.zara.net/assets/public/4663/361d/cab8491482b0/9803c6ed0c1e/09229244800-e1/09229244800-e1.jpg?ts=1760692599824&w=2240',
    color: 'black',
  },
  {
    id: 'ci8',
    name: 'Leather jacket',
    category: 'outerwear',
    image_url:
      'https://static.zara.net/assets/public/4ebc/14e0/e17349b58249/2443af81627e/06318253716-000-e1/06318253716-000-e1.jpg?ts=1765811498778&w=2240',
    color: 'black',
  },
  {
    id: 'ci9',
    name: 'Party boots',
    category: 'shoes',
    image_url:
      'https://static.zara.net/assets/public/36e0/94fe/51994fbfa1cd/e33b48f6753d/13103710800-e2/13103710800-e2.jpg?ts=1764608202125&w=2240',
    color: 'black',
  },
  {
    id: 'ci11',
    name: 'Knitted Scarf',
    category: 'accessories',
    image_url:
      'https://static.zara.net/assets/public/b774/7641/e9a74eecb1b7/015ea928c159/05987202717-e1/05987202717-e1.jpg?ts=1761912828509&w=2240',
    color: 'brown',
  },
  {
    id: 'ci12',
    name: 'Leopard Beanie',
    category: 'accessories',
    image_url:
      'https://static.zara.net/assets/public/ed80/a924/61ca49e4a349/d84c0c269bdf/03739005051-e1/03739005051-e1.jpg?ts=1764930897761&w=2240',
    color: 'leopard',
  },
];

let mockPlannedOutfits: PlannedOutfit[] = [
  { id: 'po1', date: '2026-01-15', clothing_items: ['ci1', 'ci3'], occasion: 'Casual Day Out' },
  { id: 'po2', date: '2026-01-16', clothing_items: ['ci5'], occasion: 'Dinner Party' },
];

const mockApi = {
  list: (_options?: string) => {
    // eslint-disable-line @typescript-eslint/no-explicit-any
    if (_options === 'ClothingItem') {
      return Promise.resolve(mockClothingItems);
    }
    if (_options === 'PlannedOutfit') {
      return Promise.resolve(mockPlannedOutfits);
    }
    return Promise.resolve([]);
  },
  create: (data: any) => {
    // eslint-disable-line @typescript-eslint/no-explicit-any
    const newItem = { id: `new-${Date.now()}`, ...data };
    mockPlannedOutfits.push(newItem);
    return Promise.resolve(newItem);
  },
  bulkCreate: (data: any[]) => {
    // eslint-disable-line @typescript-eslint/no-explicit-any
    const newItems = data.map((item) => ({ id: `new-${Date.now()}-${Math.random()}`, ...item }));
    mockClothingItems.push(...newItems);
    return Promise.resolve(newItems);
  },
  update: (id: any, data: any) => {
    // eslint-disable-line @typescript-eslint/no-explicit-any
    let updatedItem: any = null;
    mockPlannedOutfits = mockPlannedOutfits.map((item) => {
      if (item.id === id) {
        updatedItem = { ...item, ...data };
        return updatedItem;
      }
      return item;
    });
    return Promise.resolve(updatedItem);
  },
  delete: (id: any) => {
    // eslint-disable-line @typescript-eslint/no-explicit-any
    mockClothingItems = mockClothingItems.filter((item) => item.id !== id);
    mockPlannedOutfits = mockPlannedOutfits.filter((item) => item.id !== id);
    return Promise.resolve({ id });
  },
};

export const nova = {
  entities: {
    ClothingItem: {
      list: () => mockApi.list('ClothingItem'),
      bulkCreate: mockApi.bulkCreate,
      delete: mockApi.delete,
    },
    PlannedOutfit: {
      list: () => mockApi.list('PlannedOutfit'),
      create: mockApi.create,
      update: mockApi.update,
      delete: mockApi.delete,
    },
  },
  integrations: {
    Core: {
      UploadFile: ({ _file }: { _file: any }) => Promise.resolve({ file_url: 'mock_file_url' }), // eslint-disable-line @typescript-eslint/no-explicit-any
      InvokeLLM: ({
        _prompt,
        _file_urls,
        _response_json_schema,
      }: {
        _prompt: string;
        _file_urls: string[];
        _response_json_schema: any;
      }) => Promise.resolve({ items: [] }), // eslint-disable-line @typescript-eslint/no-explicit-any
      invokeClothesProcesser: ({ image_url }: { image_url: string }) => {
        const dummyItems: ClothingItem[] = [
          {
            id: `proc-${Date.now()}-1`,
            name: 'Zara Top',
            category: 'tops',
            image_url:
              'https://static.zara.net/assets/public/570f/d39a/16ff4150b140/204f0f1d9de5/03905532250-e1/03905532250-e1.jpg?ts=1740389594337&w=688',
            color: 'white',
          },
          {
            id: `proc-${Date.now()}-2`,
            name: 'Zara Bottom',
            category: 'bottoms',
            image_url:
              'https://static.zara.net/assets/public/c190/d12d/8d704943b7ff/b839f8c2d7a4/04060217800-e1/04060217800-e1.jpg?ts=1758209153466&w=688',
            color: 'black',
          },
        ];
        return Promise.resolve(dummyItems);
      },
    },
  },
};
