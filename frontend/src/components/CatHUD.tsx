// src/components/CatHUD.tsx
import React, { useState } from 'react';
import { useCatGame, SHOP_ITEMS } from '../context/CatGameContext';

export const CatHUD: React.FC = () => {
  const { catStats, catPoints, buyItem, interactionMode, setInteractionMode, inventory, equippedItems, placedItems, currentRoom, resetGame, isDarkMode, currentSkin } = useCatGame();
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const theme = {
      bg: isDarkMode ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
      text: isDarkMode ? '#ecf0f1' : '#2f3542',
      border: isDarkMode ? '#444' : '#eee',
      modalBg: isDarkMode ? '#2c3e50' : 'white',
      itemBg: isDarkMode ? '#34495e' : '#fafafa',
      shopBtnDisabled: isDarkMode ? '#7f8c8d' : '#ced6e0',
  };

  if (isMinimized) return <button onClick={() => setIsMinimized(false)} style={{ position: 'fixed', top: 10, left: 10, width: '50px', height: '50px', borderRadius: '50%', border: '2px solid #fff', backgroundColor: 'rgba(255, 140, 0, 0.9)', color: 'white', fontSize: '24px', cursor: 'pointer', zIndex: 10002 }}>🐱</button>;

  return (
    <>
      <div style={{ position: 'fixed', top: 10, left: 10, backgroundColor: theme.bg, color: theme.text, padding: '12px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', zIndex: 10002, display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '220px', fontFamily: 'sans-serif', border: `1px solid ${theme.border}` }}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:`1px solid ${theme.border}`, paddingBottom:'8px'}}>
            <div style={{fontWeight: 'bold', color: '#FF8C00', fontSize: '18px', display:'flex', alignItems:'center', gap:'5px'}}><span>💰</span> {catPoints}</div>
            <button onClick={() => setIsMinimized(true)} style={{background: 'none', border: 'none', cursor: 'pointer', color: theme.text}}>_</button>
        </div>
        <div style={{fontSize: '12px', display:'flex', flexDirection:'column', gap:'4px'}}>
            <div style={{background: isDarkMode?'#555':'#eee',height:'6px',borderRadius:'4px'}}><div style={{width:`${catStats.hunger}%`,background:'#ff6b6b',height:'100%'}}/></div>
            <div style={{background: isDarkMode?'#555':'#eee',height:'6px',borderRadius:'4px'}}><div style={{width:`${catStats.happiness}%`,background:'#ff9ff3',height:'100%'}}/></div>
            <div style={{background: isDarkMode?'#555':'#eee',height:'6px',borderRadius:'4px'}}><div style={{width:`${catStats.hygiene}%`,background:'#48dbfb',height:'100%'}}/></div>
        </div>
        <div style={{display: 'flex', gap: '5px', marginTop: '5px'}}>
            <button onClick={() => setInteractionMode(interactionMode === 'NORMAL' ? 'BRUSH' : 'NORMAL')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: interactionMode === 'BRUSH' ? '#48dbfb' : (isDarkMode?'#555':'#f0f0f0'), color: theme.text, fontWeight:'bold', fontSize:'11px'}}>{interactionMode === 'BRUSH' ? '🧼 ถูตัว' : '🖐️ จับเล่น'}</button>
            <button onClick={() => setInteractionMode(interactionMode === 'EDIT_FURNITURE' ? 'NORMAL' : 'EDIT_FURNITURE')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: interactionMode === 'EDIT_FURNITURE' ? '#FFD700' : (isDarkMode?'#555':'#f0f0f0'), color: interactionMode === 'EDIT_FURNITURE'?'#2f3542':theme.text, fontWeight:'bold', fontSize:'11px'}}>{interactionMode === 'EDIT_FURNITURE' ? '✅ เสร็จ' : '🔨 แต่งห้อง'}</button>
        </div>
        <button onClick={() => setIsShopOpen(!isShopOpen)} style={{width:'100%', padding:'8px', borderRadius:'8px', border:'none', background:'#FF8C00', color:'white', fontWeight:'bold', cursor:'pointer'}}>🛒 ร้านค้า</button>
        <div style={{textAlign: 'center'}}><button onClick={() => { if(window.confirm('ลบเซฟ?')) resetGame() }} style={{fontSize: '10px', color: '#aaa', background:'none', border:'none', cursor:'pointer', textDecoration:'underline'}}>ล้างข้อมูล</button></div>
      </div>

      {isShopOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10003, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ backgroundColor: theme.modalBg, color: theme.text, padding: '20px', borderRadius: '20px', width: '400px', maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}>
            <button onClick={() => setIsShopOpen(false)} style={{position: 'absolute', top: '15px', right: '15px', border:'none', background:'none', fontSize:'18px', cursor:'pointer', color: theme.text}}>✕</button>
            <h2 style={{textAlign:'center', margin:'0 0 20px 0'}}>🛒 ร้านค้า</h2>
            <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
              {SHOP_ITEMS.map(item => {
                  const isOwned = inventory.includes(item.id);
                  const canBuy = catPoints >= item.price;
                  let btnText = `${item.price}💰`;
                  if (item.type === 'room') btnText = currentRoom === item.image ? 'ใช้อยู่' : (isOwned ? 'เปลี่ยนห้อง' : btnText);
                  else if (item.type === 'skin') btnText = currentSkin === item.skinValue ? 'ใช้อยู่' : (isOwned ? 'เปลี่ยนสี' : btnText);
                  else if (isOwned && item.type !== 'food' && item.type !== 'decoration') btnText = item.type==='accessory'?(equippedItems.includes(item.id)?'ถอด':'ใส่'):'เล่นเลย';
                  else if (item.type === 'decoration') btnText = 'ซื้อเพิ่ม';

                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', border: `1px solid ${theme.border}`, borderRadius: '12px', padding: '10px', background: theme.itemBg }}>
                      <img src={item.image} style={{width:'50px', height:'50px', objectFit:'contain', marginRight:'10px', background:'white', border:'1px solid #ddd', borderRadius:'8px'}} />
                      <div style={{flex: 1}}><div style={{fontWeight:'bold'}}>{item.name}</div><div style={{fontSize:'10px', color: isDarkMode?'#aaa':'#888'}}>{item.type}</div></div>
                      <button onClick={() => buyItem(item)} disabled={(!canBuy && !isOwned) || (item.type==='room'&&currentRoom===item.image)} 
                        style={{ background: (canBuy || isOwned) ? '#2ecc71' : theme.shopBtnDisabled, color:'white', border:'none', padding:'5px 10px', borderRadius:'15px', cursor:'pointer'}}>
                        {btnText}
                      </button>
                    </div>
                  );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};