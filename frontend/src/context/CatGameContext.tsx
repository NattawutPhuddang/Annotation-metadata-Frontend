// src/context/CatGameContext.tsx
import React, { createContext, useContext, useState, ReactNode, useRef, useEffect } from 'react';

// === CONSTANTS ===
export const GAME_WIDTH = 400;
export const GAME_HEIGHT = 300;

// === 1. Types Definitions ===
export type CatAction = 'IDLE' | 'WALKING' | 'SITTING' | 'SLEEPING' | 'DRAGGED' | 'FALLING' | 'EATING' | 'PLAYING' | 'CHASING' | 'POKING';
export type InteractionMode = 'NORMAL' | 'BRUSH' | 'EDIT_FURNITURE';
export type CatDirection = 'left' | 'right';
export type CatSkin = 'default' | 'black' | 'orange' | 'grey' | 'white' | 'calico';

export interface GameItem {
  id: string; name: string; price: number;
  type: 'food' | 'accessory' | 'toy' | 'decoration' | 'room' | 'skin';
  effect: { hunger?: number; happiness?: number; hygiene?: number; }; image: string;
  skinValue?: CatSkin;
}

export interface PlacedItem { instanceId: string; itemId: string; x: number; y: number; }
export interface ActiveToyState { id: string; x: number; y: number; vx: number; vy: number; item: GameItem; isDragging: boolean; }
export interface CatStats { hunger: number; happiness: number; hygiene: number; }
export interface Particle { id: number; x: number; y: number; type: 'heart' | 'sparkle' | 'dust' | 'note'; life: number; }

// === 2. Shop Data ===
export const SHOP_ITEMS: GameItem[] = [
  // Foods
  { id: 'meo', name: 'อาหารเม็ด Me-o', price: 100, type: 'food', effect: { hunger: 15, happiness: 5 }, image: '/CatItems/CatToys/catfood.png' },
  { id: 'caneva', name: 'ปลาสด Caneva', price: 250, type: 'food', effect: { hunger: 20, happiness: 10 }, image: '/CatItems/CatToys/fish.png' },
  { id: 'wet_food', name: 'อาหารเปียก', price: 50, type: 'food', effect: { hunger: 5, happiness: 5 }, image: '/CatItems/CatToys/CatBowls.png' },
  // Toys
  { id: 'ball', name: 'ลูกบอลเด้งดึ๋ง', price: 1500, type: 'toy', effect: { happiness: 20, hunger: -5 }, image: '/CatItems/CatToys/BlueBall.gif' },
  { id: 'orange_ball', name: 'บอลส้มซิ่ง', price: 1500, type: 'toy', effect: { happiness: 20, hunger: -5 }, image: '/CatItems/CatToys/OrangeBall.gif' },
  { id: 'mouse_toy', name: 'หนูไขลาน', price: 2500, type: 'toy', effect: { happiness: 30, hunger: -10 }, image: '/CatItems/CatToys/Mouse.gif' },
  // Furniture
  { id: 'bed_blue', name: 'เตียงฟ้า', price: 5000, type: 'decoration', effect: { happiness: 50 }, image: '/CatItems/Beds/CatBedBlue.png' },
  { id: 'bed_pink', name: 'เตียงชมพู', price: 5000, type: 'decoration', effect: { happiness: 50 }, image: '/CatItems/Beds/CatBedPink.png' },
  { id: 'cat_condo', name: 'คอนโดแมว', price: 8000, type: 'decoration', effect: { happiness: 80 }, image: '/CatItems/Beds/CatHomes.png' },
  // Rooms
  { id: 'room_1', name: 'ห้องนั่งเล่น', price: 2000, type: 'room', effect: { happiness: 10 }, image: '/CatItems/Rooms/Room1.png' },
  { id: 'room_2', name: 'ห้องครัว', price: 3000, type: 'room', effect: { happiness: 15 }, image: '/CatItems/Rooms/Room2.png' },
  { id: 'room_3', name: 'ห้องนอน', price: 4000, type: 'room', effect: { happiness: 20 }, image: '/CatItems/Rooms/Room3.png' },
  // Accessories
  { id: 'sunglasses', name: 'แว่นสุดเท่', price: 500, type: 'accessory', effect: { happiness: 20 }, image: 'https://cdn-icons-png.flaticon.com/512/186/186315.png' },
  { id: 'tophat', name: 'หมวกมายากล', price: 800, type: 'accessory', effect: { happiness: 30 }, image: 'https://cdn-icons-png.flaticon.com/512/10673/10673445.png' },
  // Skins
  { id: 'skin_default', name: 'ลายสลิด (Original)', price: 1000, type: 'skin', skinValue: 'default', effect: {}, image: '/Pochi/AllCats.png' },
  { id: 'skin_black', name: 'แมวดำนำโชค', price: 1000, type: 'skin', skinValue: 'black', effect: {}, image: '/Pochi/AllCatsBlack.png' },
  { id: 'skin_orange', name: 'แมวส้มตัวตึง', price: 1000, type: 'skin', skinValue: 'orange', effect: {}, image: '/Pochi/AllCatsOrange.png' },
  { id: 'skin_grey', name: 'แมวเทาผู้ดี', price: 1000, type: 'skin', skinValue: 'grey', effect: {}, image: '/Pochi/AllCatsGrey.png' },
  { id: 'skin_white', name: 'แมวขาวคุณหนู', price: 1000, type: 'skin', skinValue: 'white', effect: {}, image: '/Pochi/AllCatsWhite.png' },
];

interface CatGameState {
  catPosition: { x: number; y: number };
  catAction: CatAction;
  direction: CatDirection;
  isDragging: boolean;
  catStats: CatStats;
  catPoints: number;
  inventory: string[];
  equippedItems: string[];
  placedItems: PlacedItem[];
  currentRoom: string;
  spawnedItem: { item: GameItem; x: number; y: number } | null;
  activeToy: ActiveToyState | null;
  currentSkin: CatSkin; 
  particles: Particle[];
  isDarkMode: boolean;

  moveCat: (x: number, y: number, duration?: number, callback?: () => void) => void;
  setCatAction: (action: CatAction) => void;
  setCatPosition: React.Dispatch<React.SetStateAction<{x:number, y:number}>>;
  setIsDragging: (b: boolean) => void;
  addPoints: (n: number) => void;
  buyItem: (item: GameItem) => void;
  activateToy: (item: GameItem) => void;
  clearSpawnedItem: () => void;
  clearActiveToy: () => void;
  setActiveToy: React.Dispatch<React.SetStateAction<ActiveToyState | null>>;
  updateStats: (e: any) => void;
  toggleEquip: (id: string) => void;
  moveFurniture: (instanceId: string, x: number, y: number) => void;
  interactionMode: InteractionMode;
  setInteractionMode: (m: InteractionMode) => void;
  scrubCat: () => void;
  resetGame: () => void;
  spawnParticle: (x: number, y: number, type: 'heart'|'sparkle'|'dust'|'note') => void;
  playSound: (type: 'meow'|'purr'|'pop'|'eat') => void;
}

const CatGameContext = createContext<CatGameState | undefined>(undefined);

// *** แก้ไข 1: เพิ่ม userId ใน props ***
export const CatGameProvider: React.FC<{ children: ReactNode; userId?: string }> = ({ children, userId = 'guest' }) => {
  const [catPosition, setCatPositionState] = useState({ x: GAME_WIDTH/2 - 40, y: GAME_HEIGHT - 100 });
  const [catAction, setCatAction] = useState<CatAction>('IDLE');
  const [direction, setDirection] = useState<CatDirection>('right');
  const [isDragging, setIsDragging] = useState(false);
  const [catPoints, setCatPoints] = useState(1500);
  const [catStats, setCatStats] = useState({ hunger: 50, happiness: 50, hygiene: 50 });
  const [inventory, setInventory] = useState<string[]>([]);
  const [equippedItems, setEquippedItems] = useState<string[]>([]);
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);
  const [currentRoom, setCurrentRoom] = useState<string>('/CatItems/Rooms/Room1.png');
  const [spawnedItem, setSpawnedItem] = useState<{ item: GameItem; x: number; y: number } | null>(null);
  const [activeToy, setActiveToy] = useState<ActiveToyState | null>(null);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('NORMAL');
  const walkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [currentSkin, setCurrentSkin] = useState<CatSkin>('default');
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const matchDark = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(matchDark.matches);
    const listener = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    matchDark.addEventListener('change', listener);
    return () => matchDark.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    if (particles.length === 0) return;
    const interval = setInterval(() => setParticles(p => p.map(pt => ({...pt, life: pt.life - 5})).filter(pt => pt.life > 0)), 50);
    return () => clearInterval(interval);
  }, [particles.length]);

  // === แก้ไข 2: โหลดข้อมูลตาม userId ===
  useEffect(() => {
    const key = `catGameData_${userId}`; // ชื่อเซฟเป็น catGameData_EMP001
    const saved = localStorage.getItem(key);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            setCatPoints(parsed.catPoints ?? 1500);
            setCatStats(parsed.catStats ?? { hunger: 50, happiness: 50, hygiene: 50 });
            setInventory(parsed.inventory ?? []);
            setEquippedItems(parsed.equippedItems ?? []);
            setPlacedItems(parsed.placedItems ?? []);
            setCurrentRoom(parsed.currentRoom ?? '/CatItems/Rooms/Room1.png');
            setCurrentSkin(parsed.currentSkin ?? 'default');
        } catch(e) { console.error(e); }
    } else {
        // *** ถ้าเป็น User ใหม่ ให้สุ่มสีแมว ***
        const skins: CatSkin[] = ['black', 'orange', 'grey', 'white', 'calico', 'default'];
        const randomSkin = skins[Math.floor(Math.random() * skins.length)];
        setCurrentSkin(randomSkin);
        
        // Reset ค่าเป็นค่าเริ่มต้น
        setCatPoints(1500);
        setInventory([]);
        setEquippedItems([]);
        setPlacedItems([]);
        setCatStats({ hunger: 50, happiness: 50, hygiene: 50 });
        setCurrentRoom('/CatItems/Rooms/Room1.png');
    }
  }, [userId]); // ทำงานเมื่อ userId เปลี่ยน

  // === แก้ไข 3: บันทึกข้อมูลตาม userId ===
  useEffect(() => {
    const key = `catGameData_${userId}`;
    localStorage.setItem(key, JSON.stringify({ catPoints, catStats, inventory, equippedItems, placedItems, currentRoom, currentSkin }));
  }, [catPoints, catStats, inventory, equippedItems, placedItems, currentRoom, currentSkin, userId]);

  const spawnParticle = (x: number, y: number, type: 'heart'|'sparkle'|'dust'|'note') => setParticles(p => [...p, { id: Date.now()+Math.random(), x, y, type, life: 100 }]);
  const playSound = (type: string) => { };

  const buyItem = (item: GameItem) => {
    if (item.type === 'skin' && item.skinValue) {
        if (catPoints >= item.price || inventory.includes(item.id)) {
            if(!inventory.includes(item.id)) { setCatPoints(p => p - item.price); setInventory(p => [...p, item.id]); }
            setCurrentSkin(item.skinValue); spawnParticle(GAME_WIDTH/2, GAME_HEIGHT/2, 'sparkle');
        } else alert("เงินไม่พอจ้า!"); return;
    }
    if (item.type === 'room') {
        if (catPoints >= item.price || inventory.includes(item.id)) {
            if(!inventory.includes(item.id)) { setCatPoints(p => p - item.price); setInventory(p => [...p, item.id]); }
            setCurrentRoom(item.image);
        } else alert("เงินไม่พอจ้า!"); return;
    }
    if (item.type === 'decoration') {
        if (catPoints >= item.price || inventory.includes(item.id)) {
             if(!inventory.includes(item.id)) { setCatPoints(p => p - item.price); setInventory(p => [...p, item.id]); }
             const newItem: PlacedItem = { instanceId: Date.now().toString(), itemId: item.id, x: GAME_WIDTH/2 - 40, y: GAME_HEIGHT - 100 };
             setPlacedItems(p => [...p, newItem]); setInteractionMode('EDIT_FURNITURE');
        } else alert("เงินไม่พอจ้า!"); return;
    }
    if (inventory.includes(item.id)) {
        if (item.type === 'accessory') toggleEquip(item.id); else if (item.type === 'toy') activateToy(item); return;
    }
    if (catPoints >= item.price) {
      setCatPoints(p => p - item.price);
      if (item.type === 'food') setSpawnedItem({ item, x: Math.random()*(GAME_WIDTH-60), y: GAME_HEIGHT-60 });
      else { setInventory(p => [...p, item.id]); if(item.type==='accessory') toggleEquip(item.id); if(item.type==='toy') activateToy(item); }
    } else alert("เงินไม่พอจ้า!");
  };

  const activateToy = (item: GameItem) => {
    setActiveToy(null); setSpawnedItem(null);
    const vx = (Math.random() > 0.5 ? 1 : -1) * (3 + Math.random() * 3); 
    const vy = item.id.includes('ball') ? -10 : 0;
    setActiveToy({ id: Date.now().toString(), item, x: GAME_WIDTH/2, y: GAME_HEIGHT/2, vx, vy, isDragging: false });
  };
  const moveCat = (x: number, y: number, duration: number = 3000, callback?: () => void) => {
    if (isDragging) return;
    if (walkTimeoutRef.current) clearTimeout(walkTimeoutRef.current);
    if (x > catPosition.x) setDirection('right'); else setDirection('left');
    setCatPositionState({ x, y });
    setCatAction(duration < 1000 ? 'CHASING' : 'WALKING');
    walkTimeoutRef.current = setTimeout(() => { if (!activeToy) setCatAction('SITTING'); if (callback) callback(); }, duration); 
  };
  const moveFurniture = (id: string, x: number, y: number) => setPlacedItems(p => p.map(i => i.instanceId === id ? { ...i, x, y } : i));
  const addPoints = (n: number) => setCatPoints(p => p + n);
  const clearSpawnedItem = () => setSpawnedItem(null);
  const clearActiveToy = () => setActiveToy(null);
  const updateStats = (e: any) => setCatStats(p => ({ hunger: Math.min(100,Math.max(0,p.hunger+(e.hunger||0))), happiness: Math.min(100,Math.max(0,p.happiness+(e.happiness||0))), hygiene: Math.min(100,Math.max(0,p.hygiene+(e.hygiene||0))) }));
  const toggleEquip = (id: string) => setEquippedItems(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);
  const scrubCat = () => { setCatStats(p => ({...p, hygiene: Math.min(100, p.hygiene+0.5)})); if(Math.random()<0.2) spawnParticle(catPosition.x+64, catPosition.y, 'heart'); };
  const resetGame = () => { const key = `catGameData_${userId}`; localStorage.removeItem(key); window.location.reload(); };

  return (
    <CatGameContext.Provider value={{ catPosition, catAction, direction, isDragging, moveCat, setCatAction, setCatPosition: setCatPositionState, setIsDragging, catStats, catPoints, spawnedItem, activeToy, placedItems, currentRoom, addPoints, buyItem, activateToy, clearSpawnedItem, clearActiveToy, setActiveToy, moveFurniture, updateStats, inventory, equippedItems, toggleEquip, interactionMode, setInteractionMode, scrubCat, resetGame, isDarkMode, currentSkin, particles, spawnParticle, playSound }}>
      {children}
    </CatGameContext.Provider>
  );
};
export const useCatGame = () => {
    const context = useContext(CatGameContext);
    if (!context) throw new Error('useCatGame must be used within a CatGameProvider');
    return context;
};