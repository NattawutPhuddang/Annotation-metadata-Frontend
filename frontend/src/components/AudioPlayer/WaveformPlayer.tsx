// src/components/AudioPlayer/WaveformPlayer.tsx
import React, { useRef, useEffect, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import './WaveformPlayer.css';

interface Props {
  audioUrl: string;
  isPlaying: boolean;
  onPlayChange?: (isPlaying: boolean) => void;
  progressColor?: string;
  height?: string;
}

export const WaveformPlayer: React.FC<Props> = ({
  audioUrl,
  isPlaying,
  onPlayChange,
  progressColor = '#818cf8',
  height = 'h-1.5'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // 1. เพิ่ม State เช็คความพร้อม
  const [isReady, setIsReady] = useState(false);

  const onPlayChangeRef = useRef(onPlayChange);
  useEffect(() => {
    onPlayChangeRef.current = onPlayChange;
  }, [onPlayChange]);

  const getCleanUrl = (url: string) => {
    if (!url) return '';
    const match = url.match(/(blob:.*)/);
    return match ? match[1] : url;
  };
  const cleanUrl = getCleanUrl(audioUrl);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current || !cleanUrl) return;

    // รีเซ็ตสถานะเมื่อเปลี่ยน URL
    setIsReady(false);

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#cbd5e1',
      progressColor: progressColor,
      cursorColor: 'transparent',
      barWidth: 2,
      barRadius: 3,
      cursorWidth: 1,
      height: 24,
      barGap: 2,
      url: cleanUrl,
      normalize: true,
      interact: true,
      dragToSeek: true,
    });

    wavesurfer.current = ws;

    ws.on('ready', (d) => {
      setDuration(d);
      // 2. แจ้งว่าพร้อมเล่นแล้ว
      setIsReady(true);
    });

    ws.on('audioprocess', (t) => {
      setCurrentTime(t);
    });

    ws.on('finish', () => {
      onPlayChangeRef.current?.(false);
    });
    
    ws.on('interaction', () => {
      onPlayChangeRef.current?.(true);
    });

    return () => {
      ws.destroy();
      // รีเซ็ตเมื่อ component unmount หรือเปลี่ยนไฟล์
      setIsReady(false);
    };
  }, [cleanUrl, progressColor]); // เพิ่ม progressColor ใน deps เพื่อความถูกต้อง

  // 3. ปรับ Logic การ Sync Play/Pause ให้รอ isReady ด้วย
  useEffect(() => {
    if (!wavesurfer.current || !isReady) return; // ถ้ายงไม่พร้อม ให้ข้ามไปก่อน
    
    try {
        if (isPlaying) {
          wavesurfer.current.play();
        } else {
          wavesurfer.current.pause();
        }
    } catch (e) {
        console.error("WaveSurfer error", e);
    }
  }, [isPlaying, isReady]); // ทำงานเมื่อ isPlaying เปลี่ยน หรือเมื่อ isReady เปลี่ยนเป็น true
  
  const formatTime = (t: number) => {
    if (!t || isNaN(t)) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full flex flex-col">
      <div className="flex justify-end mb-1">
        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 tabular-nums leading-none">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      <div 
        className={`waveform-wrapper w-full ${height} flex items-center bg-slate-50/50 rounded-lg overflow-hidden`}
      >
        <div ref={containerRef} className="w-full" />
      </div>
    </div>
  );
};