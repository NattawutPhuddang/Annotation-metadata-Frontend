// src/components/CatAvatar.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useCatGame } from '../context/CatGameContext';

// === Config: ตั้งค่าจำนวนเฟรมของแต่ละไฟล์ให้ถูกต้องตรงนี้ ===
const SPRITES: Record<string, { src: string; frames: number; speed: number }> = {
  // แก้ IDLE เป็น 6 เฟรม ตามที่คุณแจ้ง
  IDLE: { src: '/Pochi/Sprites/Idle.png', frames: 6, speed: 0.8 }, 
  SITTING: { src: '/Pochi/Sprites/Idle.png', frames: 6, speed: 0.8 },
  
  // ลองเช็คไฟล์ Running.png ดูนะครับ ปกติ Pochi อาจจะมี 4 หรือ 8 เฟรม
  // ถ้าวิ่งแล้วกระตุก ให้ลองแก้เป็น 8 ดูครับ
  WALKING: { src: '/Pochi/Sprites/Running.png', frames: 6, speed: 0.6 },
  
  // ท่าอื่นๆ ปกติมักจะ 4 เฟรม
  DRAGGED: { src: '/Pochi/Sprites/Tickle.png', frames: 4, speed: 0.4 },
  FALLING: { src: '/Pochi/Sprites/Surprised.png', frames: 4, speed: 0.4 },
  EATING: { src: '/Pochi/Sprites/Happy.png', frames: 10, speed: 0.8 },
  FULL: { src: '/Pochi/Sprites/Dead.png', frames: 10, speed: 0.8 },
  SLEEPING: { src: '/Pochi/Sprites/Sleeping.png', frames: 4, speed: 1.0 },
  CHILLING: { src: '/Pochi/Sprites/Chilling.png', frames: 8, speed: 1.0 },
};

// ขนาดตัวแมว (pixel)
const CAT_SIZE = 128; 

export const CatAvatar: React.FC = () => {
  const { 
    catPosition, catAction, setCatPosition, setCatAction, setIsDragging, isDragging, 
    equippedItems, interactionMode, scrubCat, direction 
  } = useCatGame();
  
  const dragOffset = useRef({ x: 0, y: 0 });
  const [bubbles, setBubbles] = useState<{x:number, y:number, id: number}[]>([]);

  // --- Logic เดิม ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (interactionMode === 'BRUSH') return;
    e.preventDefault();
    setIsDragging(true);
    setCatAction('DRAGGED');
    dragOffset.current = { x: e.clientX - catPosition.x, y: e.clientY - catPosition.y };
  };

  const handleMouseMoveOnCat = (e: React.MouseEvent) => {
     if (interactionMode === 'BRUSH' && e.buttons === 1) {
         scrubCat();
         const id = Date.now();
         setBubbles(prev => [...prev, { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, id }]);
         setTimeout(() => setBubbles(prev => prev.filter(b => b.id !== id)), 800);
     }
  };

  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        setCatPosition({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
      };
      const handleMouseUp = () => {
          if (!isDragging) return;
          setIsDragging(false);
          const floorLevel = window.innerHeight - 150;
          if (catPosition.y < floorLevel) {
              setCatAction('FALLING');
              const fallInterval = setInterval(() => {
                  setCatPosition(prev => {
                      const nextY = prev.y + 15;
                      if (nextY >= floorLevel) { clearInterval(fallInterval); setCatAction('SITTING'); return { x: prev.x, y: floorLevel }; }
                      return { x: prev.x, y: nextY };
                  });
              }, 16);
          } else { setCatAction('SITTING'); }
      };
      if (isDragging) { window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp); }
      return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isDragging, setCatPosition, setIsDragging, setCatAction, catPosition.y]);

  // --- Animation Setup ---
  const currentSprite = SPRITES[catAction] || SPRITES['IDLE'];
  const isFlipped = direction === 'left';
  const shouldFlip = isFlipped && (catAction !== 'DRAGGED' && catAction !== 'FALLING');
  
  // *** คำนวณความกว้างตามจำนวนเฟรมของท่านั้นๆ ***
  // เช่น Idle 6 เฟรม = 128 * 6 = 768px
  // Running 4 เฟรม = 128 * 4 = 512px
  const bgWidth = currentSprite.frames * CAT_SIZE; 
  const endPosition = -bgWidth; 

  const renderAccessories = () => (
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {equippedItems.includes('sunglasses') && (
            <img 
                src="https://cdn-icons-png.flaticon.com/512/186/186315.png" 
                alt="glasses"
                style={{
                    position: 'absolute', top: '35%', left: '35%', width: '40%', 
                    filter: 'brightness(0)', transform: shouldFlip ? 'scaleX(-1)' : 'none'
                }} 
            />
        )}
        {equippedItems.includes('tophat') && (
            <div style={{
                position: 'absolute', top: '-10%', left: '25%', width: '50%', height: '40%',
                backgroundImage: 'linear-gradient(to bottom, #333 80%, #C0392B 80%)',
                clipPath: 'polygon(20% 0%, 80% 0%, 80% 100%, 100% 100%, 100% 100%, 0% 100%, 0% 100%, 20% 100%)',
                transform: shouldFlip ? 'scaleX(-1)' : 'none'
            }}>
                <div style={{width:'60%', height:'100%', background:'#333', margin:'0 auto'}} />
            </div>
        )}
      </div>
  );

  return (
    <div 
        style={{
            position: 'fixed',
            left: `${catPosition.x}px`, 
            top: `${catPosition.y}px`,
            width: `${CAT_SIZE}px`, 
            height: `${CAT_SIZE}px`,
            transition: isDragging ? 'none' : (catAction === 'FALLING' ? 'top 0.1s linear' : 'top 3s linear, left 3s linear'),
            zIndex: 9999,
            cursor: interactionMode === 'BRUSH' ? 'url(https://img.icons8.com/emoji/32/000000/soap-emoji.png), auto' : (isDragging ? 'grabbing' : 'grab'),
            transform: `${catAction === 'DRAGGED' ? 'scale(1.1) rotate(5deg)' : 'scale(1)'} ${shouldFlip ? 'scaleX(-1)' : ''}`,
            imageRendering: 'pixelated', 
            
            // Background Logic
            backgroundImage: `url(${currentSprite.src})`,
            backgroundRepeat: 'no-repeat',
            // ตรงนี้จะขยายตามจำนวนเฟรมที่ตั้งไว้ใน SPRITES อัตโนมัติ
            backgroundSize: `${bgWidth}px ${CAT_SIZE}px`, 
            
            // Steps จะแบ่งตามจำนวนเฟรมที่ตั้งไว้
            animation: `playSprite-${catAction} ${currentSprite.speed}s steps(${currentSprite.frames}) infinite`
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMoveOnCat}
    >
        {renderAccessories()}
        {bubbles.map(b => (
            <div key={b.id} style={{ position: 'absolute', left: b.x, top: b.y, fontSize: '20px', pointerEvents: 'none', animation: 'fadeUp 0.8s forwards' }}>🧼</div>
        ))}
        
        {/* Dynamic Keyframes */}
        <style>{`
            @keyframes playSprite-${catAction} {
                from { background-position: 0px 0px; }
                to { background-position: ${endPosition}px 0px; }
            }
            @keyframes fadeUp { 
                0% { opacity: 1; transform: translateY(0); } 
                100% { opacity: 0; transform: translateY(-30px); } 
            }
        `}</style>
    </div>
  );
};