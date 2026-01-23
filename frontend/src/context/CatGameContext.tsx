// src/context/CatGameContext.tsx
import React, { createContext, useContext, useState, ReactNode, useRef, useEffect } from 'react';

// === 1. Define Types ===
export type CatAction = 'IDLE' | 'WALKING' | 'SITTING' | 'SLEEPING' | 'DRAGGED' | 'FALLING' | 'EATING' | 'PLAYING';
export type InteractionMode = 'NORMAL' | 'BRUSH';
export type CatDirection = 'left' | 'right';

export interface CatStats {
  hunger: number;    
  happiness: number; 
  hygiene: number;   
}

export interface GameItem {
  id: string;
  name: string;
  price: number;
  type: 'food' | 'accessory' | 'toy';
  effect: {
    hunger?: number;
    happiness?: number;
    hygiene?: number;
  };
  image: string; // <-- เปลี่ยนจาก emoji เป็น image path
}

export interface SpawnedItem {
  item: GameItem;
  x: number;
  y: number;
}

export interface CatPosition {
  x: number;
  y: number;
}

// === 2. Shop Data (ใช้รูปจาก CatItems) ===
export const SHOP_ITEMS: GameItem[] = [
  // --- หมวดอาหาร ---
  { 
    id: 'meo', name: 'อาหารเม็ด Me-o', price: 100, type: 'food', 
    effect: { hunger: 10, happiness: 5, hygiene: -2 }, 
    image: '/CatItems/CatToys/catfood.png' 
  },
  { 
    id: 'caneva', name: 'ปลาสด Caneva', price: 250, type: 'food', 
    effect: { hunger: 15, happiness: 10, hygiene: -5 }, 
    image: '/CatItems/CatToys/fish.png' 
  },
  { 
    id: 'wet_food', name: 'อาหารเปียก', price: 50, type: 'food', 
    effect: { hunger: 5, happiness: 5, hygiene: -2 }, 
    image: '/CatItems/CatToys/CatBowls.png' 
  },
  
  // --- หมวดของเล่น (ใช้ GIF ดุ๊กดิ๊ก) ---
  { 
    id: 'ball', name: 'ลูกบอลเด้งดึ๋ง', price: 150, type: 'toy', 
    effect: { happiness: 15, hunger: -2 }, 
    image: '/CatItems/CatToys/BlueBall.gif' 
  },
  { 
    id: 'mouse_toy', name: 'หนูไขลาน', price: 300, type: 'toy', 
    effect: { happiness: 25, hunger: -3 }, 
    image: '/CatItems/CatToys/Mouse.gif' 
  },
  { 
    id: 'orange_ball', name: 'บอลส้ม', price: 150, type: 'toy', 
    effect: { happiness: 15, hunger: -2 }, 
    image: '/CatItems/CatToys/OrangeBall.gif' 
  },
  // ของเล่นชิ้นใหญ่ (เตียง) - สมมติว่าเป็น Toy ไปก่อนเพื่อให้วางแล้วแมวเดินไปหาได้
  { 
    id: 'bed_blue', name: 'เตียงนุ่มฟู', price: 500, type: 'toy', 
    effect: { happiness: 40, hunger: 0 }, 
    image: '/CatItems/Beds/CatBedBlue.png' 
  },

  // --- หมวดของแต่งตัว (ใช้รูป Icon ภายนอกเหมือนเดิม หรือวาดเอง) ---
  { 
    id: 'sunglasses', name: 'แว่นสุดเท่', price: 500, type: 'accessory', 
    effect: { happiness: 20 }, 
    image: 'https://cdn-icons-png.flaticon.com/512/186/186315.png' 
  },
  { 
    id: 'tophat', name: 'หมวกมายากล', price: 800, type: 'accessory', 
    effect: { happiness: 30 }, 
    image: 'https://cdn-icons-png.flaticon.com/512/10673/10673445.png' 
  },
];

interface CatGameState {
  catPosition: CatPosition;
  catAction: CatAction;
  direction: CatDirection;
  isDragging: boolean;
  catStats: CatStats;
  catPoints: number;
  spawnedItem: SpawnedItem | null;
  interactionMode: InteractionMode;
  inventory: string[];
  equippedItems: string[];
  
  moveCat: (x: number, y: number, callback?: () => void) => void;
  setCatAction: (action: CatAction) => void;
  setCatPosition: React.Dispatch<React.SetStateAction<CatPosition>>;
  setIsDragging: (dragging: boolean) => void;
  addPoints: (amount: number) => void;
  buyItem: (item: GameItem) => void;
  clearSpawnedItem: () => void;
  updateStats: (effect: Partial<CatStats>) => void;
  toggleEquip: (itemId: string) => void;
  setInteractionMode: (mode: InteractionMode) => void;
  scrubCat: () => void;
  resetGame: () => void;
}

const CatGameContext = createContext<CatGameState | undefined>(undefined);

export const CatGameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // --- States ---
  const [catPosition, setCatPositionState] = useState<CatPosition>({ x: 100, y: window.innerHeight - 150 });
  const [catAction, setCatAction] = useState<CatAction>('IDLE');
  const [direction, setDirection] = useState<CatDirection>('right');
  const [isDragging, setIsDragging] = useState(false);
  
  const [catPoints, setCatPoints] = useState(1500);
  const [catStats, setCatStats] = useState<CatStats>({ hunger: 50, happiness: 50, hygiene: 50 });
  const [inventory, setInventory] = useState<string[]>([]);
  const [equippedItems, setEquippedItems] = useState<string[]>([]);

  const [spawnedItem, setSpawnedItem] = useState<SpawnedItem | null>(null);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('NORMAL');

  const walkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // === Save / Load System ===
  useEffect(() => {
    const savedData = localStorage.getItem('catGameData');
    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            setCatPoints(parsed.catPoints || 1500);
            setCatStats(parsed.catStats || { hunger: 50, happiness: 50, hygiene: 50 });
            setInventory(parsed.inventory || []);
            setEquippedItems(parsed.equippedItems || []);
        } catch (e) {
            console.error("Failed to load save", e);
        }
    }
  }, []);

  useEffect(() => {
    const dataToSave = { catPoints, catStats, inventory, equippedItems };
    localStorage.setItem('catGameData', JSON.stringify(dataToSave));
  }, [catPoints, catStats, inventory, equippedItems]);

  const resetGame = () => {
    localStorage.removeItem('catGameData');
    window.location.reload();
  };

  const moveCat = (x: number, y: number, callback?: () => void) => {
    if (isDragging) return;
    if (walkTimeoutRef.current) clearTimeout(walkTimeoutRef.current);

    if (x > catPosition.x) setDirection('right');
    else if (x < catPosition.x) setDirection('left');

    setCatPositionState({ x, y });
    setCatAction('WALKING');
    
    walkTimeoutRef.current = setTimeout(() => {
        setCatAction('SITTING');
        if (callback) callback(); 
    }, 3000); 
  };

  const addPoints = (amount: number) => setCatPoints(prev => prev + amount);

  const buyItem = (item: GameItem) => {
    if (inventory.includes(item.id) && item.type === 'accessory') {
        toggleEquip(item.id);
        return;
    }

    if (catPoints >= item.price) {
      setCatPoints(prev => prev - item.price);
      
      if (item.type === 'food' || item.type === 'toy') {
        const groundY = window.innerHeight - 100; // ปรับความสูงเล็กน้อยตามขนาดรูป
        const randomX = Math.floor(Math.random() * (window.innerWidth - 100));
        setSpawnedItem({ item, x: randomX, y: groundY });
      } else if (item.type === 'accessory') {
        setInventory(prev => [...prev, item.id]);
        toggleEquip(item.id); 
      }
    } else {
      alert("CatPoints ไม่พอจ้า!");
    }
  };

  const clearSpawnedItem = () => setSpawnedItem(null);

  const updateStats = (effect: Partial<CatStats>) => {
    setCatStats(prev => ({
      hunger: Math.min(100, Math.max(0, prev.hunger + (effect.hunger || 0))),
      happiness: Math.min(100, Math.max(0, prev.happiness + (effect.happiness || 0))),
      hygiene: Math.min(100, Math.max(0, prev.hygiene + (effect.hygiene || 0))),
    }));
  };

  const toggleEquip = (itemId: string) => {
    setEquippedItems(prev => {
      if (prev.includes(itemId)) return prev.filter(id => id !== itemId);
      return [...prev, itemId];
    });
  };

  const scrubCat = () => {
    setCatStats(prev => {
        const newHygiene = Math.min(100, prev.hygiene + 0.5);
        let newHappiness = prev.happiness;
        if (newHygiene >= 100 && prev.happiness < 100) {
             newHappiness = Math.min(100, prev.happiness + 0.1);
        }
        return { ...prev, hygiene: newHygiene, happiness: newHappiness };
    });
  };

  return (
    <CatGameContext.Provider value={{ 
      catPosition, catAction, direction, isDragging, moveCat, setCatAction, setCatPosition: setCatPositionState, setIsDragging,
      catStats, catPoints, spawnedItem, addPoints, buyItem, clearSpawnedItem, updateStats,
      inventory, equippedItems, toggleEquip, interactionMode, setInteractionMode, scrubCat,
      resetGame
    }}>
      {children}
    </CatGameContext.Provider>
  );
};

export const useCatGame = () => {
  const context = useContext(CatGameContext);
  if (!context) throw new Error('useCatGame must be used within a CatGameProvider');
  return context;
};