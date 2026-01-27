// src/components/CatSystem.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useCatGame, SHOP_ITEMS, GAME_WIDTH, GAME_HEIGHT } from '../context/CatGameContext';
import { CatAvatar } from './CatAvatar';

export const CatSystem: React.FC = () => {
  const { 
    moveCat, isDragging, spawnedItem, activeToy, 
    placedItems, // *** เปลี่ยนจาก placedDecorations เป็น placedItems ***
    currentRoom, 
    setCatAction, clearSpawnedItem, clearActiveToy, updateStats, setActiveToy, catAction,
    interactionMode, moveFurniture, particles
  } = useCatGame();

  // === Container Drag ===
  const [containerPos, setContainerPos] = useState({ x: 20, y: window.innerHeight - GAME_HEIGHT - 20 });
  const [isContainerDragging, setIsContainerDragging] = useState(false);
  const containerDragOffset = useRef({ x: 0, y: 0 });

  const handleContainerMouseDown = (e: React.MouseEvent) => {
      if (interactionMode !== 'EDIT_FURNITURE') return;
      if (draggedFurniture) return;
      e.preventDefault(); setIsContainerDragging(true);
      containerDragOffset.current = { x: e.clientX - containerPos.x, y: e.clientY - containerPos.y };
  };

  // === Furniture Drag ===
  const [draggedFurniture, setDraggedFurniture] = useState<string | null>(null);
  const dragFurnOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const getRelativePos = (e: MouseEvent | React.MouseEvent) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleFurnMouseDown = (e: React.MouseEvent, instanceId: string, x: number, y: number) => {
      if (interactionMode !== 'EDIT_FURNITURE') return;
      e.preventDefault(); e.stopPropagation(); 
      setDraggedFurniture(instanceId);
      const rel = getRelativePos(e);
      dragFurnOffset.current = { x: rel.x - x, y: rel.y - y };
  };

  // Global Listeners
  useEffect(() => {
      const move = (e: MouseEvent) => {
          if (isContainerDragging) {
              setContainerPos({ x: e.clientX - containerDragOffset.current.x, y: e.clientY - containerDragOffset.current.y });
          }
          if(draggedFurniture) {
              const rel = getRelativePos(e);
              moveFurniture(draggedFurniture, rel.x - dragFurnOffset.current.x, rel.y - dragFurnOffset.current.y); 
          }
          if (activeToyRef.current?.isDragging) {
              const rel = getRelativePos(e);
              if (physicsRef.current) { physicsRef.current.x = rel.x - 24; physicsRef.current.y = rel.y - 24; physicsRef.current.vx=0; physicsRef.current.vy=0; }
              setActiveToy(prev => prev ? { ...prev, x: rel.x - 24, y: rel.y - 24 } : null);
          }
      };
      const up = (e: MouseEvent) => {
          setIsContainerDragging(false); setDraggedFurniture(null);
          if (activeToyRef.current?.isDragging && dragStartRef.current) {
              const rel = getRelativePos(e);
              const dt = Date.now() - dragStartRef.current.time;
              const throwVx = ((rel.x - dragStartRef.current.x) / dt) * 15;
              const throwVy = ((rel.y - dragStartRef.current.y) / dt) * 15;
              if (physicsRef.current) { physicsRef.current.vx = Math.min(Math.max(throwVx,-20),20); physicsRef.current.vy = Math.min(Math.max(throwVy,-20),20); }
              setActiveToy(prev => prev ? { ...prev, isDragging: false } : null);
              dragStartRef.current = null;
          }
      };
      window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
      return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [isContainerDragging, draggedFurniture, moveFurniture]);

  // Logic Refs
  const isDraggingRef = useRef(isDragging);
  const activeToyRef = useRef(activeToy);
  const reqRef = useRef<number | null>(null);
  const physicsRef = useRef<{x:number, y:number, vx:number, vy:number} | null>(null);
  const dragStartRef = useRef<{x:number, y:number, time:number} | null>(null);

  useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);
  useEffect(() => { activeToyRef.current = activeToy; }, [activeToy]);

  // Food Logic
  useEffect(() => {
    if (spawnedItem && !isDragging) {
      moveCat(spawnedItem.x - 30, spawnedItem.y - 50, 2000, () => {
        setCatAction('EATING');
        setTimeout(() => { updateStats(spawnedItem.item.effect); clearSpawnedItem(); setCatAction('SITTING'); }, 4000);
      });
    }
  }, [spawnedItem]);

  // Toy Physics
  useEffect(() => {
    if (!activeToy) { physicsRef.current = null; return; }
    if (!physicsRef.current) physicsRef.current = { x: activeToy.x, y: activeToy.y, vx: activeToy.vx, vy: activeToy.vy };
    const loop = () => {
      const p = physicsRef.current!; const toy = activeToyRef.current!;
      if (!toy.isDragging) {
          p.x += p.vx; p.y += p.vy; p.vx *= 0.99; 
          if (toy.item.id.includes('ball')) {
             p.vy += 0.8; if (p.y > GAME_HEIGHT - 60) { p.y = GAME_HEIGHT - 60; p.vy *= -0.7; if (Math.abs(p.vy) < 1) p.vy = 0; }
             if (p.x <= 0 || p.x >= GAME_WIDTH - 40) p.vx *= -1;
          } else { 
             p.y = GAME_HEIGHT - 50; if (p.x <= 20 || p.x >= GAME_WIDTH - 50) p.vx *= -1;
          }
      }
      if (!toy.isDragging) setActiveToy(prev => prev ? { ...prev, x: p.x, y: p.y } : null);
      if (!isDraggingRef.current && catAction !== 'FALLING' && catAction !== 'DRAGGED') {
          if (!toy.isDragging) {
              moveCat(p.x - 40, p.y - 50, 100);
              if (Math.abs(p.vx) < 2 && Math.abs(p.vy) < 2 && Math.random() < 0.05) {
                  setCatAction('POKING');
                  setTimeout(() => {
                      if(physicsRef.current) { physicsRef.current.vx = (Math.random()>0.5?1:-1) * (10 + Math.random()*5); physicsRef.current.vy = -10; }
                      setCatAction('CHASING');
                  }, 500);
              }
          }
      }
      reqRef.current = requestAnimationFrame(loop);
    };
    reqRef.current = requestAnimationFrame(loop);
    const stopTimer = setTimeout(() => { if(reqRef.current) cancelAnimationFrame(reqRef.current); updateStats(activeToy.item.effect); clearActiveToy(); setCatAction('SITTING'); }, 20000);
    return () => { if(reqRef.current) cancelAnimationFrame(reqRef.current); clearTimeout(stopTimer); };
  }, [activeToy]);

  const handleToyMouseDown = (e: React.MouseEvent) => {
      if (!activeToy) return; e.preventDefault(); e.stopPropagation();
      const rel = getRelativePos(e);
      dragStartRef.current = { x: rel.x, y: rel.y, time: Date.now() };
      setActiveToy(prev => prev ? { ...prev, isDragging: true } : null);
  };

  // Idle Logic
  useEffect(() => {
    if (spawnedItem || activeToy || isDragging || interactionMode === 'EDIT_FURNITURE') return;
    const idleLoop = setInterval(() => {
      if (Math.random() > 0.6) { 
        // หาเตียงจากรายการที่วาง (placedItems)
        const bed = placedItems.find(p => p.itemId.includes('bed'));
        if (bed) moveCat(bed.x + 30, bed.y - 30, 3000, () => setCatAction('SLEEPING'));
        else moveCat(GAME_WIDTH / 2 - 40, GAME_HEIGHT - 100, 3000, () => setCatAction('SLEEPING'));
      } else {
        moveCat(Math.random() * (GAME_WIDTH-100), GAME_HEIGHT-100-Math.random()*30);
      }
    }, 10000); 
    return () => clearInterval(idleLoop);
  }, [spawnedItem, activeToy, isDragging, placedItems, interactionMode]);

  return (
    <div 
        ref={containerRef}
        className="cat-game-container"
        onMouseDown={handleContainerMouseDown} 
        style={{
            position: 'fixed', left: containerPos.x, top: containerPos.y,
            width: GAME_WIDTH, height: GAME_HEIGHT, zIndex: 9990,
            overflow: 'visible',
            cursor: interactionMode === 'EDIT_FURNITURE' ? 'move' : 'default',
            border: interactionMode === 'EDIT_FURNITURE' ? '2px dashed rgba(0,0,0,0.3)' : 'none'
        }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundImage: `url(${currentRoom})`, backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 0, borderRadius: '15px', overflow: 'hidden', pointerEvents: 'none' }} />

      {/* Render Furniture from placedItems */}
      {placedItems.map(p => {
          const item = SHOP_ITEMS.find(i => i.id === p.itemId);
          if(!item) return null;
          return <img key={p.instanceId} src={item.image} onMouseDown={(e)=>handleFurnMouseDown(e,p.instanceId,p.x,p.y)}
            style={{ position:'absolute', left:p.x, top:p.y, width:'100px', zIndex:1, imageRendering:'pixelated', cursor: interactionMode==='EDIT_FURNITURE'?'move':'default', border: (interactionMode==='EDIT_FURNITURE' && draggedFurniture===p.instanceId)?'2px dashed blue':'none' }} />
      })}

      {activeToy && <img src={activeToy.item.image} onMouseDown={handleToyMouseDown} style={{ position:'absolute', left:activeToy.x, top:activeToy.y, width:'48px', zIndex:10, cursor:'grab', imageRendering:'pixelated', transform: (activeToy.item.id.includes('mouse')&&activeToy.vx<0)?'scaleX(-1)':'none' }} />}
      
      <CatAvatar />

      {spawnedItem && <img src={spawnedItem.item.image} style={{ position:'absolute', left:spawnedItem.x, top:spawnedItem.y, width:'50px', zIndex:15, animation:'bounce 1s infinite', imageRendering:'pixelated' }} />}
      
      {particles.map(p => (
          <div key={p.id} style={{ position: 'absolute', left: p.x, top: p.y, pointerEvents: 'none', fontSize: '20px', animation: 'floatUp 1s forwards', opacity: p.life / 100, zIndex: 10002 }}>
              {p.type === 'heart' && '💖'} {p.type === 'sparkle' && '✨'} {p.type === 'dust' && '💨'}
          </div>
      ))}
      <style>{`@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } } @keyframes floatUp { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-30px) scale(1.5); opacity: 0; } }`}</style>
    </div>
  );
};