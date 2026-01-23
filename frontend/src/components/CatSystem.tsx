// src/components/CatSystem.tsx
import React, { useEffect } from 'react';
import { useCatGame } from '../context/CatGameContext';
import { CatAvatar } from './CatAvatar';

export const CatSystem: React.FC = () => {
  const { 
    moveCat, isDragging, spawnedItem, 
    setCatAction, clearSpawnedItem, updateStats 
  } = useCatGame();

  // 1. AI เดินเล่น
  useEffect(() => {
    if (spawnedItem) return;

    const walkInterval = setInterval(() => {
      if (isDragging) return;
      if (spawnedItem) return; 

      const maxX = window.innerWidth - 100;
      const groundY = window.innerHeight - 150; 
      const randomX = Math.floor(Math.random() * maxX);
      const randomY = groundY - Math.floor(Math.random() * 50);

      moveCat(randomX, randomY);
      
    }, Math.floor(Math.random() * 5000) + 8000); 

    return () => clearInterval(walkInterval);
  }, [moveCat, isDragging, spawnedItem]);

  // 2. Logic เดินไปหาของ
  useEffect(() => {
    if (spawnedItem && !isDragging) {
      // เดินไปหาของ (ปรับ offset ให้แมวอยู่ข้างๆ ของ)
      // ลบ offset เยอะหน่อยเพื่อให้แมวไม่บังของ
      moveCat(spawnedItem.x - 60, spawnedItem.y - 60, () => {
        if (spawnedItem.item.type === 'food') {
            setCatAction('EATING');
        } else if (spawnedItem.item.type === 'toy') {
            setCatAction('PLAYING');
        }
        
        setTimeout(() => {
          updateStats(spawnedItem.item.effect);
          clearSpawnedItem(); 
          setCatAction('SITTING'); 
        }, 4000); // เล่นนานขึ้นหน่อย (4 วิ) จะได้เห็น Animation ของเล่น
      });
    }
  }, [spawnedItem]); 

  return (
    <>
      {spawnedItem && (
        <img 
            src={spawnedItem.item.image}
            alt={spawnedItem.item.name}
            style={{
                position: 'fixed',
                left: spawnedItem.x,
                top: spawnedItem.y,
                width: '64px', // กำหนดขนาดของ
                height: '64px', // ปรับได้ตามชอบ
                objectFit: 'contain',
                zIndex: 9998,
                // ใส่ Animation เด้งดึ๋งเล็กน้อย (ถ้าไม่ใช่ GIF ก็จะเห็นเด้งๆ)
                animation: 'bounce 1s infinite',
                imageRendering: 'pixelated'
            }}
        />
      )}
      
      <CatAvatar />
      <style>{`
        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
        }
      `}</style>
    </>
  );
};