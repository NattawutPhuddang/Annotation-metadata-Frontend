import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { AudioItem } from "../types";
import { audioService, syncOfflineActions } from "../api/audioService";
import localforage from "localforage"; // Import เข้ามา

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
  suggestions: Map<string, string>;  // ADD THIS LINE
  inspectText: (text: string) => Promise<string[]>;
  
  // Actions
  handleDecision: (item: AudioItem, status: "correct" | "incorrect", smartEdits?: Record<number, string>) => Promise<void>;
  handleCorrection: (item: AudioItem, newText: string) => Promise<void>;
  moveToTrash: (filename: string, source?: "correct" | "incorrect") => Promise<void>;
  playAudio: (item: AudioItem) => void;
  playingFile: string | null;
  getFileName: (base: string) => string;

  //แจ้งเตือน
  broadcastMessage: (text: string) => Promise<void>; // ฟังก์ชันสำหรับคนส่ง
  incomingAnnouncement: { text: string; sender: string } | null; // ข้อความที่ได้รับ
  dismissAnnouncement: () => void; // ปิดข้อความ
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

  const [incomingAnnouncement, setIncomingAnnouncement] = useState<{ text: string; sender: string } | null>(null);
  const [lastAnnounceTime, setLastAnnounceTime] = useState<number>(0);

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
  // Theme Effect
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDarkMode ? "dark" : "light");
    localStorage.setItem("isDarkMode", JSON.stringify(isDarkMode));
  }, [isDarkMode]);

//   // Persist Data Effect
//   useEffect(() => {
//     if (employeeId) localStorage.setItem("employeeId", employeeId);
//     localStorage.setItem("hasStarted", JSON.stringify(hasStarted));
//     localStorage.setItem("audioPath", audioPath);
//     // Note: Don't persist full audioFiles with blob URLs if possible, strict to logic
//     const safeToSave = audioFiles.map((a) => ({ ...a, audioPath: "" })); 
//     localStorage.setItem("audioFiles", JSON.stringify(safeToSave));
//     localStorage.setItem("correctData", JSON.stringify(correctData));
//     localStorage.setItem("incorrectData", JSON.stringify(incorrectData));
//     localStorage.setItem("changes", JSON.stringify(changes));
//   }, [employeeId, hasStarted, audioPath, audioFiles, correctData, incorrectData, changes]);

//     // 1. เพิ่ม Effect สำหรับเซฟข้อมูลลงเครื่องอัตโนมัติ เมื่อมีการเปลี่ยนแปลง
// useEffect(() => {
//   localStorage.setItem('cached_correct', JSON.stringify(correctData));
//   localStorage.setItem('cached_fail', JSON.stringify(incorrectData));
//   localStorage.setItem('cached_changes', JSON.stringify(changes));
// }, [correctData, incorrectData, changes]);
useEffect(() => {
  const saveDataLocally = async () => {
      try {
          await Promise.all([
              localforage.setItem('cached_correct', correctData),
              localforage.setItem('cached_fail', incorrectData),
              localforage.setItem('cached_changes', changes)
          ]);
      } catch (err) {
          console.error("Error saving local cache:", err);
      }
  };
  saveDataLocally();
}, [correctData, incorrectData, changes]);

  // 2. Initial Load Data (ปรับปรุงจากเดิม)
  useEffect(() => {
    if (!employeeId) return;

    const initData = async () => {
        setLoading(true, "Syncing data...");
        
        // ลองดึงจาก Server (กรณี Online)
        const serverData = await audioService.fetchInitialData(employeeId);
        
        if (serverData) {
            // ถ้ามีเน็ต: ใช้ข้อมูล Server
            setCorrectData(serverData.correct.reverse());
            setIncorrectData(serverData.fail.reverse());
            setChanges(serverData.changes);
        } else {
            // 🔴 ถ้าไม่มีเน็ต (Offline): ดึงจาก LocalStorage ที่เราเซฟไว้
            console.log("Offline mode: Loading cached data");
            const cachedCorrect = localStorage.getItem('cached_correct');
            const cachedFail = localStorage.getItem('cached_fail');
            const cachedChanges = localStorage.getItem('cached_changes');

            if (cachedCorrect) setCorrectData(JSON.parse(cachedCorrect));
            if (cachedFail) setIncorrectData(JSON.parse(cachedFail));
            if (cachedChanges) setChanges(JSON.parse(cachedChanges));
        }
        
        setLoading(false);
    };

    initData();
    
    // ลอง Sync ของที่ค้างเผื่อมี
    if (navigator.onLine) {
        syncOfflineActions();
    }
  }, [employeeId]);


  useEffect(() => {
    const saveDataLocally = async () => {
        try {
            // localforage เก็บ Object ได้เลย ไม่ต้อง JSON.stringify
            await Promise.all([
                localforage.setItem('cached_correct', correctData),
                localforage.setItem('cached_fail', incorrectData),
                localforage.setItem('cached_changes', changes)
            ]);
        } catch (err) {
            console.error("Error saving local cache:", err);
        }
    };
    saveDataLocally();
  }, [correctData, incorrectData, changes]);

  // 2. Initial Load Data (ปรับปรุงจากเดิม)
  useEffect(() => {
    if (!employeeId) return;

    const initData = async () => {
        setLoading(true, "Syncing data...");
        
        // ลองดึงจาก Server
        const serverData = await audioService.fetchInitialData(employeeId);
        
        if (serverData) {
            // Online: ใช้ข้อมูล Server
            setCorrectData(serverData.correct.reverse());
            setIncorrectData(serverData.fail.reverse());
            setChanges(serverData.changes);
        } else {
            // Offline: ดึงจาก localforage
            console.log("Offline mode: Loading cached data");
            try {
                const cachedCorrect = await localforage.getItem<AudioItem[]>('cached_correct');
                const cachedFail = await localforage.getItem<AudioItem[]>('cached_fail');
                const cachedChanges = await localforage.getItem<any[]>('cached_changes'); // หรือใส่ Type ให้ถูก

                if (cachedCorrect) setCorrectData(cachedCorrect);
                if (cachedFail) setIncorrectData(cachedFail);
                if (cachedChanges) setChanges(cachedChanges);
            } catch (err) {
                console.error("Error loading local cache:", err);
            }
        }
        
        setLoading(false);
    };

    initData();
    
    if (navigator.onLine) {
        syncOfflineActions();
    }
  }, [employeeId]);

  useEffect(() => {
  const checkAnnouncement = async () => {
    const data = await audioService.getAnnouncement();
    // ถ้ามีข้อความ และ เวลาของข้อความ มากกว่า เวลาล่าสุดที่เคยรับ
    // และต้องไม่เก่าเกินไป (เช่น เกิน 1 ชั่วโมงถือว่าเก่าแล้ว ไม่ต้องเด้ง)
    const ONE_HOUR = 60 * 60 * 1000;
    const isRecent = (Date.now() - data.timestamp) < ONE_HOUR;

    if (data.text && data.timestamp > lastAnnounceTime && isRecent) {
      setIncomingAnnouncement({ text: data.text, sender: data.sender });
      setLastAnnounceTime(data.timestamp); // จำไว้ว่าอ่านอันนี้แล้ว
    } else if (data.timestamp > lastAnnounceTime) {
         // กรณีข้อความเก่ามากแล้ว แต่อัพเดท timestamp เพื่อกันเช็คซ้ำ
         setLastAnnounceTime(data.timestamp);
    }

    
  };


 

  // เรียกครั้งแรกทันที
  checkAnnouncement();

  // ตั้งเวลาเช็ควนไป
  const interval = setInterval(checkAnnouncement, 5000);
  return () => clearInterval(interval);
}, [lastAnnounceTime]);

// ฟังก์ชันส่งประกาศ (สำหรับ Admin กด)
const broadcastMessage = async (text: string) => {
  await audioService.sendAnnouncement(text, employeeId);
};

// ฟังก์ชันปิด Modal
const dismissAnnouncement = () => {
  setIncomingAnnouncement(null);
};

  // --- Core Business Logic ---

  // 1. Inspect / Tokenize
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

  // 2. Decision Logic (Correct/Fail)
  const handleDecision = async (item: AudioItem, status: "correct" | "incorrect", smartEdits?: Record<number, string>) => {
    let finalItem = { ...item };
    const logName = getFileName("Correct.tsv");

    // Merge Smart Edits if any
    if (smartEdits && Object.keys(smartEdits).length > 0) {
        let tokens = tokenCache.get(item.text);
        if (!tokens) tokens = await inspectText(item.text);
        
        if (tokens.length > 0) {
            const newText = tokens.map((t, i) => smartEdits[i] || t).join("");
            finalItem.text = newText;
             // Clear cache for this text as it changed
            setTokenCache(prev => {
                const next = new Map(prev);
                next.delete(item.text);
                return next;
            });
        }
    }

    const moveToTrash = async (filename: string, source: "correct" | "incorrect" = "incorrect") => {
    try {
      // เรียก API (ที่แก้ Backend แล้ว) เพื่อย้ายไฟล์ลง Trash แบบไม่ Stack
      await audioService.moveToTrash(filename, source === "correct" ? "Correct.tsv" : "fail.tsv");
      
      // หาข้อมูล item นั้น (เพื่อเอาไปใส่ใน trashData state)
      const item = audioFiles.find(f => f.filename === filename) || 
                   incorrectData.find(f => f.filename === filename) || 
                   correctData.find(f => f.filename === filename) || 
                   { filename, text: "" };

      // Update State: เพิ่มลง Trash Data
      setTrashData(prev => {
          // กันซ้ำใน state
          if (prev.some(t => t.filename === filename)) return prev;
          return [...prev, item];
      });

      // Update State: ลบออกจาก Source เดิม
      if (source === "correct") {
        setCorrectData(prev => prev.filter(i => i.filename !== filename));
      } else {
        setIncorrectData(prev => prev.filter(i => i.filename !== filename));
      }

    } catch (error) {
      console.error("Failed to move to trash", error);
    }
    };
    
    // Update State
    if (status === "correct") {
      setCorrectData(prev => [finalItem, ...prev]);
      setIncorrectData(prev => prev.filter(i => i.filename !== finalItem.filename));
      
      // API Calls
      await audioService.appendTsv("Correct.tsv", finalItem, logName); // ส่ง logName
      await audioService.deleteTsvEntry("fail.tsv", finalItem.filename);
      
      // Log User Action
      // const logName = getFileName("Correct.tsv");
      await audioService.appendTsv(logName, finalItem);

    } else {
      setIncorrectData(prev => [finalItem, ...prev]);
      setCorrectData(prev => prev.filter(i => i.filename !== finalItem.filename));

      // API Calls
      await audioService.appendTsv("fail.tsv", finalItem); 
      await audioService.deleteTsvEntry("Correct.tsv", finalItem.filename);
      await audioService.deleteTsvEntry(logName, finalItem.filename);
      
      // Delete User Log if exists
      // const logName = getFileName("Correct.tsv");
      await audioService.deleteTsvEntry(logName, finalItem.filename); // Assuming using delete-tsv-entry logic
    }
  };

  // 3. Correction Logic (Edit Page)
  const handleCorrection = async (item: AudioItem, newText: string) => {
    // Check for pattern (original,changed)
    const matches = [...newText.matchAll(/\(([^,]+),([^)]+)\)/g)];
    if (matches.length > 0) {
      for (const m of matches) {
        await audioService.saveChangeLog(m[1], m[2]);
      }
      // Optimistic update for changes
      const newChanges = matches.map(m => ({ original: m[1], changed: m[2] }));
      setChanges(prev => [...prev, ...newChanges]);
    }

    const cleanText = newText.replace(/\(([^,]+),([^)]+)\)/g, "$2");
    const newItem = { ...item, text: cleanText };

    // Move to Correct
    setIncorrectData(prev => prev.filter(i => i.filename !== item.filename));
    setCorrectData(prev => [newItem, ...prev]);

    // API Calls
    await audioService.appendTsv("Correct.tsv", newItem);
    await audioService.deleteTsvEntry("fail.tsv", item.filename);
    
    const logName = getFileName("Correct.tsv");
    await audioService.appendTsv(logName, newItem);
  };

  // Derived State: Pending Items
  const pendingItems = useMemo(() => {
    // Enrich with audio URL logic on the fly or pre-process
    // For simplicity, let's filter first
    const rawPending = audioFiles.filter(
      (i) => !correctData.some((c) => c.filename === i.filename) &&
             !incorrectData.some((f) => f.filename === i.filename)&&
             !trashData.some((t) => t.filename === i.filename)
    );
    
    // Enrich Logic (Move here to avoid clutter in Component)
    const fileMap = new Map<string, string>();
    audioFiles.forEach(f => { if(f.audioPath) fileMap.set(f.filename, f.audioPath) });

    return rawPending.map(i => {
         let src = i.audioPath;
         if (!src) src = fileMap.get(i.filename);
         if (src && !src.startsWith("blob:") && !src.startsWith("http")) {
             src = audioService.getAudioUrl(src); // Use service helper
         }
         return { ...i, audioPath: src };
    });
  }, [audioFiles, correctData, incorrectData,trashData]);

  // Create suggestions map from changes for O(1) lookup
  const suggestions = useMemo(() => {
    const map = new Map<string, string>();
    changes.forEach(c => {
      map.set(c.original, c.changed);
    });
    return map;
  }, [changes]);

  const moveToTrash = async (filename: string, source: "correct" | "incorrect" = "incorrect") => {
    try {
      // 1. เรียก API ย้ายไฟล์ (Backend ต้องแก้แล้วตามขั้นตอนก่อนหน้า)
      await audioService.moveToTrash(filename, source === "correct" ? "Correct.tsv" : "fail.tsv");
      
      // 2. หาข้อมูล item นั้นเพื่อเอามาใส่ใน trashData state
      // (ค้นหาจากทุกที่เพราะบางทีอาจจะเพิ่งโหลดมา)
      const item = audioFiles.find(f => f.filename === filename) || 
                   incorrectData.find(f => f.filename === filename) || 
                   correctData.find(f => f.filename === filename) || 
                   { filename, text: "" }; // Fallback ถ้าหาไม่เจอ

      // 3. Update State: เพิ่มลง Trash Data (เพื่อเอาไปหักลบกับ Pending)
      setTrashData(prev => {
          // กันซ้ำ
          if (prev.some(t => t.filename === filename)) return prev;
          return [...prev, item];
      });

      // 4. Update State: ลบออกจาก Source เดิม (Correct/Fail)
      if (source === "correct") {
        setCorrectData(prev => prev.filter(i => i.filename !== filename));
      } else {
        setIncorrectData(prev => prev.filter(i => i.filename !== filename));
      }
      
      // ลบออกจาก audioFiles หลักด้วย (เผื่อกรณีมันยังค้างอยู่)
      // setAudioFiles(prev => prev.filter(f => f.filename !== filename)); 

    } catch (error) {
      console.error("Failed to move to trash", error);
    }
  };

  // --- Refresh/Unload Handler (Silent - No Browser Dialog) ---
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasStarted && audioFiles.length > 0) {
        // Just return false to prevent default, don't show browser dialog
        return false;
      }
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
      tokenCache, suggestions,  // ADD suggestions HERE
      inspectText,
      handleDecision, handleCorrection,moveToTrash,
      playAudio, playingFile, getFileName,broadcastMessage, 
      incomingAnnouncement, 
      dismissAnnouncement
    }}>
      {children}
    </AnnotationContext.Provider>
  );
};

// 3. Custom Hook
export const useAnnotation = () => {
  const context = useContext(AnnotationContext);
  if (!context) throw new Error("useAnnotation must be used within AnnotationProvider");
  return context;
};