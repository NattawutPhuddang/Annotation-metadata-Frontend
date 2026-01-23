// src/components/CatHUD.tsx
import React, { useState } from 'react';
import { useCatGame, SHOP_ITEMS } from '../context/CatGameContext';

export const CatHUD: React.FC = () => {
  const { 
    catStats, catPoints, buyItem, 
    interactionMode, setInteractionMode, 
    inventory, equippedItems, resetGame 
  } = useCatGame();
  
  const [isShopOpen, setIsShopOpen] = useState(false);

  return (
    <>
      <div style={{
        position: 'fixed', top: 10, right: 10, 
        backgroundColor: 'rgba(255, 255, 255, 0.95)', padding: '12px', 
        borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', zIndex: 10000,
        display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '180px',
        fontFamily: 'sans-serif'
      }}>
        {/* Money */}
        <div style={{fontWeight: 'bold', color: '#FF8C00', fontSize: '18px', display:'flex', alignItems:'center', gap:'5px'}}>
            <span>💰</span> {catPoints}
        </div>
        
        {/* Stats */}
        <div style={{fontSize: '12px'}}>
          <div style={{display:'flex', justifyContent:'space-between'}}><span>🍗 หิว</span> <span>{Math.round(catStats.hunger)}%</span></div>
          <div style={{background: '#eee', height: '6px', borderRadius: '4px', overflow:'hidden'}}>
             <div style={{width: `${catStats.hunger}%`, background: '#ff6b6b', height: '100%'}}/>
          </div>
        </div>
        <div style={{fontSize: '12px'}}>
           <div style={{display:'flex', justifyContent:'space-between'}}><span>💖 สุข</span> <span>{Math.round(catStats.happiness)}%</span></div>
           <div style={{background: '#eee', height: '6px', borderRadius: '4px', overflow:'hidden'}}>
             <div style={{width: `${catStats.happiness}%`, background: '#ff9ff3', height: '100%'}}/>
          </div>
        </div>
        <div style={{fontSize: '12px'}}>
           <div style={{display:'flex', justifyContent:'space-between'}}><span>✨ สะอาด</span> <span>{Math.round(catStats.hygiene)}%</span></div>
           <div style={{background: '#eee', height: '6px', borderRadius: '4px', overflow:'hidden'}}>
             <div style={{width: `${catStats.hygiene}%`, background: '#48dbfb', height: '100%'}}/>
          </div>
        </div>

        {/* Buttons */}
        <div style={{display: 'flex', gap: '5px', marginTop: '8px'}}>
            <button 
                onClick={() => setInteractionMode(interactionMode === 'NORMAL' ? 'BRUSH' : 'NORMAL')}
                style={{
                    flex: 1, padding: '8px 5px', borderRadius: '8px', cursor: 'pointer', border: 'none',
                    backgroundColor: interactionMode === 'BRUSH' ? '#48dbfb' : '#f1f2f6',
                    color: interactionMode === 'BRUSH' ? 'white' : '#2f3542',
                    fontWeight: 'bold', fontSize: '12px', transition: '0.2s'
                }}
            >
                {interactionMode === 'BRUSH' ? '🧼 ถูตัว' : '🖐️ มือเปล่า'}
            </button>
            <button 
                onClick={() => setIsShopOpen(!isShopOpen)} 
                style={{
                    flex: 1, padding: '8px 5px', cursor: 'pointer', border:'none', borderRadius:'8px', 
                    background:'#FFD700', color: '#2f3542', fontWeight: 'bold', fontSize: '12px'
                }}
            >
              🛒 ร้านค้า
            </button>
        </div>

         {/* ปุ่ม Reset */}
         <div style={{marginTop: '5px', textAlign: 'right'}}>
            <button 
                onClick={() => { if(window.confirm('ลบเซฟเริ่มใหม่?')) resetGame() }}
                style={{fontSize: '10px', color: '#aaa', background:'none', border:'none', cursor:'pointer'}}
            >
                🔄 Reset
            </button>
         </div>
      </div>

      {/* === Shop Modal === */}
      {isShopOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10001,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{
              backgroundColor: 'white', padding: '20px', borderRadius: '20px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)', width: '400px', maxHeight: '80vh', overflowY: 'auto'
          }}>
            <h2 style={{textAlign:'center', margin:'0 0 20px 0', color: '#2f3542'}}>🛒 ร้านค้าแมวเหมียว</h2>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
              {SHOP_ITEMS.map(item => {
                  const isOwned = inventory.includes(item.id);
                  const isEquipped = equippedItems.includes(item.id);
                  const canBuy = catPoints >= item.price;
                  
                  return (
                    <div key={item.id} style={{
                        display: 'flex', alignItems: 'center', 
                        border: '1px solid #eee', borderRadius: '12px', padding: '10px',
                        background: '#fafafa'
                    }}>
                      {/* รูปสินค้า */}
                      <div style={{
                          width: '50px', height: '50px', marginRight: '15px', 
                          display:'flex', alignItems:'center', justifyContent:'center',
                          background: 'white', borderRadius: '8px', border: '1px solid #ddd'
                      }}>
                          <img src={item.image} alt={item.name} style={{maxWidth:'100%', maxHeight:'100%', imageRendering: 'pixelated'}} />
                      </div>

                      <div style={{flex: 1}}>
                        <div style={{fontWeight: 'bold', color: '#2f3542'}}>{item.name}</div>
                        <div style={{fontSize: '11px', color: '#747d8c'}}>
                           {item.effect.hunger ? `🍗 +${item.effect.hunger} ` : ''}
                           {item.effect.happiness ? `💖 +${item.effect.happiness}` : ''}
                        </div>
                      </div>
                      <button 
                        onClick={() => buyItem(item)}
                        disabled={!isOwned && !canBuy}
                        style={{
                          backgroundColor: isOwned 
                              ? (isEquipped ? '#ff6b6b' : '#48dbfb') 
                              : (canBuy ? '#2ecc71' : '#ced6e0'),
                          color: 'white', border: 'none', padding: '8px 12px', borderRadius: '20px', 
                          cursor: (!isOwned && !canBuy) ? 'not-allowed' : 'pointer', 
                          fontSize: '12px', fontWeight: 'bold', minWidth: '70px'
                        }}
                      >
                        {isOwned 
                          ? (item.type === 'accessory' 
                                ? (isEquipped ? 'ถอด' : 'ใส่') 
                                : 'ซื้อซ้ำ') 
                          : `${item.price}💰`}
                      </button>
                    </div>
                  );
              })}
            </div>
            
            <button 
                onClick={() => setIsShopOpen(false)} 
                style={{
                    marginTop: '20px', width: '100%', padding:'12px', 
                    background:'#f1f2f6', border:'none', borderRadius:'10px', 
                    cursor:'pointer', fontWeight: 'bold', color: '#57606f'
                }}
            >
                ปิดร้าน
            </button>
          </div>
        </div>
      )}
    </>
  );
};