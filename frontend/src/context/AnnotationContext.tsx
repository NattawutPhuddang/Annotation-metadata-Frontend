// src/context/AnnotationContext.tsx

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { AudioItem } from "../types";
import { audioService } from "../api/audioService";
import { db } from '../db/offlineDb';
import { useLiveQuery } from "dexie-react-hooks";

// 1. Define Shape of Context
interface AnnotationContextType {
  // Session
  employeeId: string;
  setEmployeeId: (id: string) => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  logout: () => void;

  // Data State
  audioFiles: AudioItem[];
  setAudioFiles: React.Dispatch<React.SetStateAction<AudioItem[]>>;
  correctData: AudioItem[];
  incorrectData: AudioItem[];
  setIncorrectData: React.Dispatch<React.SetStateAction<AudioItem[]>>;
  changes: Array<{ original: string; changed: string }>;
  pendingItems: AudioItem[];
  
  // UI State
  isLoading: boolean;
  loadingMsg: string;
  setLoading: (loading: boolean, msg?: string) => void;
  
  // Audio & Setup
  audioPath: string;
  setAudioPath: (path: string) => void;
  hasStarted: boolean;
  setHasStarted: (started: boolean) => void;
  
  // Cache & NLP
  tokenCache: Map<string, string[]>;
  suggestions: Map<string, string>;
  inspectText: (text: string) => Promise<string[]>;
  
  // Actions
  handleDecision: (item: AudioItem, status: "correct" | "incorrect", smartEdits?: Record<number, string>) => Promise<void>;
  handleCorrection: (item: AudioItem, newText: string) => Promise<void>;
  playAudio: (item: AudioItem) => void;
  playingFile: string | null;
  getFileName: (base: string) => string;
  downloadProgress: { current: number; total: number; isComplete: boolean };
  isOnline: boolean;
  getOfflineAudioUrl: (filename: string) => Promise<string>;
}

const AnnotationContext = createContext<AnnotationContextType | undefined>(undefined);

// 2. Provider Component
export const AnnotationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // --- State Declarations ---
  const [employeeId, setEmployeeId] = useState<string>(() => localStorage.getItem("employeeId") || "");
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => JSON.parse(localStorage.getItem("isDarkMode") || "false"));
  
  const [hasStarted, setHasStarted] = useState<boolean>(() => JSON.parse(localStorage.getItem("hasStarted") || "false"));
  const [audioPath, setAudioPath] = useState<string>(() => localStorage.getItem("audioPath") || "");
  
  const [audioFiles, setAudioFiles] = useState<AudioItem[]>(() => JSON.parse(localStorage.getItem("audioFiles") || "[]"));
  const [correctData, setCorrectData] = useState<AudioItem[]>(() => JSON.parse(localStorage.getItem("correctData") || "[]"));
  const [incorrectData, setIncorrectData] = useState<AudioItem[]>(() => JSON.parse(localStorage.getItem("incorrectData") || "[]"));
  const [changes, setChanges] = useState<Array<{ original: string; changed: string }>>(() => JSON.parse(localStorage.getItem("changes") || "[]"));
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [tokenCache, setTokenCache] = useState<Map<string, string[]>>(new Map());
  const [playingFile, setPlayingFile] = useState<string | null>(null);
  const [lastChangeMtime, setLastChangeMtime] = useState<number>(0);
  const [trashData, setTrashData] = useState<AudioItem[]>([]);

  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0, isComplete: false });
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // --- Helper Methods ---
  const setLoading = (loading: boolean, msg = "") => {
    setIsLoading(loading);
    setLoadingMsg(msg);
  };

  const getFileName = useCallback((base: string) => `${employeeId}-${base}`, [employeeId]);

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  const logout = () => {
    if (window.confirm("Log out from workspace?")) {
      setEmployeeId("");
      localStorage.removeItem("employeeId");
      setHasStarted(false);
      setAudioFiles([]);
      setAudioPath("");
      setTokenCache(new Map());
    }
  };

  const playAudio = (item: AudioItem) => {
    setPlayingFile(curr => (curr === item.filename ? null : item.filename));
  };

  // --- Effects ---
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDarkMode ? "dark" : "light");
    localStorage.setItem("isDarkMode", JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    if (employeeId) localStorage.setItem("employeeId", employeeId);
    localStorage.setItem("hasStarted", JSON.stringify(hasStarted));
    localStorage.setItem("audioPath", audioPath);
    const safeToSave = audioFiles.map((a) => ({ ...a, audioPath: "" })); 
    localStorage.setItem("audioFiles", JSON.stringify(safeToSave));
    localStorage.setItem("correctData", JSON.stringify(correctData));
    localStorage.setItem("incorrectData", JSON.stringify(incorrectData));
    localStorage.setItem("changes", JSON.stringify(changes));
  }, [employeeId, hasStarted, audioPath, audioFiles, correctData, incorrectData, changes]);

  // Initial Load & Sync
  useEffect(() => {
    if (!employeeId) return;

    Promise.all([
      audioService.loadTSV("Correct.tsv"), 
      audioService.loadTSV("fail.tsv"),
      audioService.loadTSV("trash.tsv")
    ]).then(([c, f,t]) => {
      if (c.length) setCorrectData(c.reverse());
      if (f.length) setIncorrectData(f.reverse());
      if (t && t.length) setTrashData(t);
    });

    const syncChanges = async () => {
      const serverMtime = await audioService.checkFileMtime("ListOfChange.tsv");
      if (serverMtime !== lastChangeMtime && serverMtime !== 0) {
        const newChanges = await audioService.loadChanges();
        setChanges(newChanges);
        setLastChangeMtime(serverMtime);
      }
    };

    syncChanges();
    const interval = setInterval(syncChanges, 10000);
    return () => clearInterval(interval);
  }, [employeeId]); // Removed lastChangeMtime to prevent loop

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); syncOfflineLogs(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- Pre-load All Files ---
  useEffect(() => {
    const cacheAllAudio = async () => {
        if (audioFiles.length === 0) return;
        const filesToCache = audioFiles.filter(f => 
        !correctData.some(c => c.filename === f.filename) && 
        !incorrectData.some(i => i.filename === f.filename)
        );

        setDownloadProgress({ current: 0, total: filesToCache.length, isComplete: false });

        const existingKeys = await db.audioCache.toCollection().primaryKeys();
        const existingSet = new Set(existingKeys);
        const neededFiles = filesToCache.filter(f => !existingSet.has(f.filename));
        
        let completedCount = filesToCache.length - neededFiles.length;
        setDownloadProgress(prev => ({ ...prev, current: completedCount }));

        const batchSize = 5;
            for (let i = 0; i < neededFiles.length; i += batchSize) {
                const batch = neededFiles.slice(i, i + batchSize);
                await Promise.all(batch.map(async (file) => {
                    try {
                        const separator = audioPath.includes('\\') ? '\\' : '/'; 
                        const prefix = audioPath.endsWith(separator) ? audioPath : audioPath + separator;
                        const fullPath = prefix + file.filename;
                        const blob = await audioService.fetchAudioBlob(fullPath); 
                        if (blob) {
                            await db.audioCache.put({
                                filename: file.filename,
                                blob: blob,
                                createdAt: Date.now()
                            });
                        }
                    } catch (e) { 
                        console.error("Failed to cache", file.filename, e); 
                    }
                }));
        
        completedCount += batch.length;
        setDownloadProgress(prev => ({ ...prev, current: Math.min(completedCount, filesToCache.length) }));
        }
        
        setDownloadProgress(prev => ({ ...prev, isComplete: true }));
    };
    cacheAllAudio();
  }, [audioFiles]); 


  // --- Logic Functions ---

  const inspectText = async (text: string) => {
    if (tokenCache.has(text)) return tokenCache.get(text) || [];
    try {
      const tokens = await audioService.tokenize(text);
      setTokenCache(prev => new Map(prev).set(text, tokens));
      return tokens;
    } catch {
      return [];
    }
  };

  const getOfflineAudioUrl = async (filename: string): Promise<string> => {
    const cached = await db.audioCache.get(filename);
    if (cached) return URL.createObjectURL(cached.blob);
    
    const separator = audioPath.includes('\\') ? '\\' : '/';
    const prefix = audioPath.endsWith(separator) ? audioPath : audioPath + separator;
    return audioService.getAudioUrl(prefix + filename);
  }

  // --- 4. แก้ไข handleDecision (Save Offline & Trigger Sync) ---
  const handleDecision = async (item: AudioItem, status: "correct" | "incorrect", smartEdits?: any) => {
    let finalItem = { ...item };

    // Apply Smart Edits
    if (smartEdits && Object.keys(smartEdits).length > 0) {
        let tokens = tokenCache.get(item.text);
        if (!tokens) tokens = await inspectText(item.text);
        if (tokens.length > 0) {
            finalItem.text = tokens.map((t, i) => smartEdits[i] || t).join("");
            // Clear cache
             setTokenCache(prev => {
                const next = new Map(prev);
                next.delete(item.text);
                return next;
            });
        }
    }

    const actionType = status === "correct" ? 'CORRECT' : 'FAIL';
    
    // A. บันทึกลง Local DB
    await db.logs.add({
        action: actionType,
        filename: finalItem.filename,
        data: finalItem,
        timestamp: Date.now(),
        synced: false
    });

    // B. อัปเดต UI (Optimistic)
    if (status === "correct") {
        setCorrectData(prev => [finalItem, ...prev]);
        setIncorrectData(prev => prev.filter(i => i.filename !== finalItem.filename));
    } else {
        setIncorrectData(prev => [finalItem, ...prev]);
        setCorrectData(prev => prev.filter(i => i.filename !== finalItem.filename));
    }

    // C. Sync ถ้ามีเน็ต
    if (isOnline) {
         // เรียกแบบไม่รอ (Fire and forget) แต่ให้ log error ข้างใน
         syncOfflineLogs().catch(console.error);
    }
    
    // D. ลบ Cache เสียง
    await db.audioCache.delete(item.filename);
  };

  // --- 3. Correction Logic (Edit Page) ---
  // ให้ใช้ Logic เดียวกับ handleDecision เพื่อความ Consistency
  const handleCorrection = async (item: AudioItem, newText: string) => {
    // Check for changes pattern
    const matches = [...newText.matchAll(/\(([^,]+),([^)]+)\)/g)];
    if (matches.length > 0) {
      for (const m of matches) {
        await audioService.saveChangeLog(m[1], m[2]);
      }
      const newChanges = matches.map(m => ({ original: m[1], changed: m[2] }));
      setChanges(prev => [...prev, ...newChanges]);
    }

    const cleanText = newText.replace(/\(([^,]+),([^)]+)\)/g, "$2");
    const newItem = { ...item, text: cleanText };

    // ใช้ handleDecision เพื่อให้มันจัดการ Sync + Delete ให้เอง
    await handleDecision(newItem, "correct");
  };

  // --- 5. ฟังก์ชัน Sync ข้อมูล (หัวใจสำคัญที่แก้บั๊ก) ---
  const syncOfflineLogs = async () => {
    const pendingLogs = await db.logs.where('synced').equals(0).toArray();
    if (pendingLogs.length === 0) return;

    console.log(`Syncing ${pendingLogs.length} logs...`);

    for (const log of pendingLogs) {
        try {
            if (log.action === 'CORRECT') {
                // 1. เพิ่มลง Correct
                await audioService.appendTsv('Correct.tsv', log.data);
                await audioService.appendTsv(`user-correct.tsv`, log.data);

                // 2. [สำคัญ] ลบออกจาก Fail และ Trash (ถ้าเคยมี)
                await audioService.deleteTsvEntry('fail.tsv', log.filename);
                await audioService.deleteTsvEntry('trash.tsv', log.filename);

            } else if (log.action === 'FAIL') {
                // 1. เพิ่มลง Fail
                await audioService.appendTsv('fail.tsv', log.data);
                await audioService.appendTsv(`user-fail.tsv`, log.data);

                // 2. [สำคัญ] ลบออกจาก Correct (กรณีเอาออกจาก Correct)
                await audioService.deleteTsvEntry('Correct.tsv', log.filename);
            }
            
            // Mark as synced
            await db.logs.update(log.id!, { synced: true });
            
        } catch (e) {
            console.error("Sync failed for", log.filename, e);
        }
    }
  };

  // Derived State
  const pendingItems = useMemo(() => {
    const rawPending = audioFiles.filter(
      (i) => !correctData.some((c) => c.filename === i.filename) &&
             !incorrectData.some((f) => f.filename === i.filename)&&
             !trashData.some((t) => t.filename === i.filename)
    );
    
    // Enrich Logic
    const fileMap = new Map<string, string>();
    audioFiles.forEach(f => { if(f.audioPath) fileMap.set(f.filename, f.audioPath) });

    return rawPending.map(i => {
         let src = i.audioPath;
         if (!src) src = fileMap.get(i.filename);
         if (src && !src.startsWith("blob:") && !src.startsWith("http")) {
             src = audioService.getAudioUrl(src);
         }
         return { ...i, audioPath: src };
    });
  }, [audioFiles, correctData, incorrectData, trashData]);

  const suggestions = useMemo(() => {
    const map = new Map<string, string>();
    changes.forEach(c => map.set(c.original, c.changed));
    return map;
  }, [changes]);

  // Handle Unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasStarted && audioFiles.length > 0) return false;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasStarted, audioFiles.length]);

  return (
    <AnnotationContext.Provider value={{
      employeeId, setEmployeeId,
      isDarkMode, toggleTheme, logout,
      audioFiles, setAudioFiles,
      correctData, incorrectData, setIncorrectData, changes, pendingItems,
      isLoading, loadingMsg, setLoading,
      audioPath, setAudioPath, hasStarted, setHasStarted,
      tokenCache, suggestions,
      inspectText,
      handleDecision, handleCorrection,
      playAudio, playingFile, getFileName,
      downloadProgress,
      isOnline,
      getOfflineAudioUrl,
    }}>
      {children}
    </AnnotationContext.Provider>
  );
};

export const useAnnotation = () => {
  const context = useContext(AnnotationContext);
  if (!context) throw new Error("useAnnotation must be used within AnnotationProvider");
  return context;
};