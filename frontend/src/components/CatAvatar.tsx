// src/components/CatAvatar.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useCatGame, GAME_HEIGHT } from '../context/CatGameContext';

const SPRITES: Record<string, { src: string; frames: number; speed: number }> = {
  IDLE: { src: '/Pochi/Sprites/Idle.png', frames: 6, speed: 0.8 }, 
  SITTING: { src: '/Pochi/Sprites/Idle.png', frames: 6, speed: 0.8 },
  WALKING: { src: '/Pochi/Sprites/Running.png', frames: 6, speed: 0.6 },
  CHASING: { src: '/Pochi/Sprites/Running.png', frames: 6, speed: 0.3 }, 
  DRAGGED: { src: '/Pochi/Sprites/Surprised.png', frames: 4, speed: 0.4 },
  FALLING: { src: '/Pochi/Sprites/Surprised.png', frames: 4, speed: 0.4 },
  EATING: { src: '/Pochi/Sprites/Happy.png', frames: 4, speed: 0.8 },
  POKING: { src: '/Pochi/Sprites/Attack.png', frames: 7, speed: 0.2 }, 
  PLAYING: { src: '/Pochi/Sprites/Attack.png', frames: 7, speed: 0.5 },
  SLEEPING: { src: '/Pochi/Sprites/Sleeping.png', frames: 4, speed: 1.0 },
};
const CAT_SIZE = 128; 

export const CatAvatar: React.FC = () => {
  const { catPosition, catAction, setCatPosition, setCatAction, setIsDragging, isDragging, equippedItems, interactionMode, scrubCat, direction, currentSkin, spawnParticle } = useCatGame();
  const dragOffset = useRef({ x: 0, y: 0 });
  const [bubbles, setBubbles] = useState<{x:number, y:number, id: number}[]>([]);

  // *** Skin Filter ***
  const getSkinFilter = () => {
      switch (currentSkin) {
          case 'black': return 'brightness(0.4) grayscale(100%)';
          case 'grey': return 'grayscale(100%) brightness(0.9)';
          case 'orange': return 'sepia(1) saturate(3) hue-rotate(-10deg)';
          case 'white': return 'brightness(1.5) contrast(0.8)';
          case 'calico': return 'sepia(0.5) contrast(1.2)';
          default: return 'none';
      }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (interactionMode === 'BRUSH') return;
    e.preventDefault(); e.stopPropagation(); 
    setIsDragging(true); setCatAction('DRAGGED');
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseMoveOnCat = (e: React.MouseEvent) => {
     if (interactionMode === 'BRUSH' && e.buttons === 1) {
         scrubCat(); const id = Date.now(); setBubbles(p => [...p, { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY, id }]);
         setTimeout(() => setBubbles(p => p.filter(b => b.id !== id)), 800);
     }
  };

  useEffect(() => {
      const move = (e: MouseEvent) => { 
          if(isDragging) {
              const container = document.querySelector('.cat-game-container');
              if (container) {
                  const rect = container.getBoundingClientRect();
                  setCatPosition({ x: e.clientX - rect.left - dragOffset.current.x, y: e.clientY - rect.top - dragOffset.current.y });
              }
          }
      };
      const up = () => {
          if (isDragging) {
              setIsDragging(false);
              const floor = GAME_HEIGHT - 100; // พื้นห้อง
              if (catPosition.y < floor) {
                  setCatAction('FALLING');
                  const fall = setInterval(() => {
                      setCatPosition(p => { 
                          const ny = p.y + 15; 
                          if(ny >= floor){ clearInterval(fall); setCatAction('SITTING'); spawnParticle(p.x+64, floor, 'dust'); return{x:p.x, y:floor}; } 
                          return{x:p.x, y:ny}; 
                      });
                  }, 16);
              } else setCatAction('SITTING');
          }
      };
      window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
      return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [isDragging, catPosition.y, spawnParticle]);

  const currentSprite = SPRITES[catAction] || SPRITES['IDLE'];
  const shouldFlip = direction === 'left' && (catAction !== 'DRAGGED' && catAction !== 'FALLING');
  const bgWidth = currentSprite.frames * CAT_SIZE; 
  const endPos = -bgWidth; 

  return (
    <div className="cat-avatar"
        style={{
            position: 'absolute', left: `${catPosition.x}px`, top: `${catPosition.y}px`, 
            width: `${CAT_SIZE}px`, height: `${CAT_SIZE}px`,
            transition: isDragging ? 'none' : (['FALLING','CHASING','POKING'].includes(catAction) ? 'all 0.1s linear' : 'top 3s linear, left 3s linear'),
            zIndex: 20, 
            cursor: interactionMode === 'BRUSH' ? 'url(https://img.icons8.com/emoji/32/000000/soap-emoji.png), auto' : (isDragging ? 'grabbing' : 'grab'),
            transform: `${catAction === 'DRAGGED' ? 'scale(1.1) rotate(5deg)' : 'scale(1)'} ${shouldFlip ? 'scaleX(-1)' : ''}`,
            imageRendering: 'pixelated', 
            backgroundImage: `url(${currentSprite.src})`, backgroundRepeat: 'no-repeat', backgroundSize: `${bgWidth}px ${CAT_SIZE}px`, 
            animation: `playSprite-${catAction} ${currentSprite.speed}s steps(${currentSprite.frames}) infinite`,
            filter: getSkinFilter(), // Apply Skin
        }} 
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMoveOnCat}
    >
        <div style={{position:'absolute',width:'100%',height:'100%',pointerEvents:'none', filter:'none'}}>
            {equippedItems.includes('sunglasses') && <img src="https://cdn-icons-png.flaticon.com/512/186/186315.png" style={{position:'absolute',top:'35%',left:'35%',width:'40%',filter:'brightness(0)',transform:shouldFlip?'scaleX(-1)':'none'}}/>}
            {equippedItems.includes('tophat') && <div style={{position:'absolute',top:'-10%',left:'25%',width:'50%',height:'40%',background:'linear-gradient(to bottom, #333 80%, #C0392B 80%)',clipPath:'polygon(20% 0%, 80% 0%, 80% 100%, 100% 100%, 100% 100%, 0% 100%, 0% 100%, 20% 100%)',transform:shouldFlip?'scaleX(-1)':'none'}}><div style={{width:'60%',height:'100%',background:'#333',margin:'0 auto'}}/></div>}
        </div>
        {bubbles.map(b => <div key={b.id} style={{position:'absolute',left:b.x,top:b.y,fontSize:'20px',pointerEvents:'none',animation:'fadeUp 0.8s forwards'}}>🧼</div>)}
        <style>{`@keyframes playSprite-${catAction} { from { background-position: 0px 0px; } to { background-position: ${endPos}px 0px; } } @keyframes fadeUp { 0% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-30px); } }`}</style>
    </div>
  );
};