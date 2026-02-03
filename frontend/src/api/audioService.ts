import { API_BASE } from './client';
import { AudioItem } from '../types';
import { offlineManager } from './OfflineManager';
import { pyThaiNLPService } from "../utils/pyThaiNLPService";

// ------------------------------------------------------------------
// 1. ฟังก์ชันสำหรับ Sync ข้อมูล (ที่เคย Error ว่าหาไม่เจอ)
// ------------------------------------------------------------------
export const syncOfflineActions = async () => {
  if (!navigator.onLine) return;
  
  const queue = await offlineManager.getQueue();
  if (queue.length === 0) return;

  console.log(`[Sync] Processing ${queue.length} offline actions...`);

  for (const action of queue) {
    try {
      switch (action.type) {
        case "SAVE_CORRECT":
            // ยิง API สำหรับ Correct
            await fetch(`${API_BASE}/api/append-tsv`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: "Correct.tsv", item: action.payload.item })
            });
            // ถ้ามี logName (Log ส่วนตัว) ก็ยิงด้วย
            if (action.payload.logName) {
                await fetch(`${API_BASE}/api/append-tsv`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ filename: action.payload.logName, item: action.payload.item })
                });
            }
            break;
            
        case "SAVE_FAIL":
             await fetch(`${API_BASE}/api/append-tsv`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: "fail.tsv", item: action.payload.item })
            });
            break;

        case "DELETE_ENTRY":
             await fetch(`${API_BASE}/api/delete-tsv-entry`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: action.payload.filename, key: action.payload.key })
            });
            break;
      }
    } catch (err) {
      console.error("[Sync Failed] Action:", action, err);
    }
  }

  // เคลียร์คิวเมื่อเสร็จ
  await offlineManager.clearQueue();
  console.log("[Sync] Completed.");
};

// ------------------------------------------------------------------
// 2. AudioService Object หลัก
// ------------------------------------------------------------------
export const audioService = {
  
  // --- Initialization (ที่เคย Error ว่า initTokenizer หาย) ---
  async initTokenizer() {
      // เรียกใช้ PyThaiNLP Service ให้โหลดเตรียมพร้อม
      await pyThaiNLPService.init();
  },

  // --- Loading Data ---
  async loadTSV(filename: string): Promise<AudioItem[]> {
    try {
      const res = await fetch(`${API_BASE}/api/load-file?filename=${filename}`);
      if (!res.ok) return [];
      const txt = await res.text();
      return txt
        .split("\n")
        .slice(1)
        .map((r) => {
          const [f, t] = r.trim().split("\t");
          return f && t ? { filename: f, text: t } : null;
        })
        .filter(Boolean) as AudioItem[];
    } catch {
      return [];
    }
  },

  async loadChanges(): Promise<Array<{ original: string; changed: string }>> {
    try {
      const res = await fetch(`${API_BASE}/api/load-file?filename=ListOfChange.tsv`);
      if (!res.ok) return [];
      const txt = await res.text();
      return txt
        .split("\n")
        .slice(1)
        .map((r) => {
          const [o, c] = r.trim().split("\t");
          return o && c ? { original: o, changed: c } : null;
        })
        .filter(Boolean) as any;
    } catch {
      return [];
    }
  },

  async moveToTrash(filename: string, sourceFile: string = 'Correct.tsv') {
    if (!navigator.onLine) return; 
    try {
        const res = await fetch(`${API_BASE}/api/move-to-trash`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename, sourceFile }),
        });
        if (!res.ok) throw new Error('Failed to move to trash');
        return res.json();
    } catch (e) {
        console.warn("Move to trash failed (Offline?)");
    }
  },

  async checkFileMtime(filename: string): Promise<number> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1000);
      const res = await fetch(`${API_BASE}/api/check-mtime?filename=${filename}`, { signal: controller.signal });
      clearTimeout(id);
      const data = await res.json();
      return data.mtime || 0;
    } catch {
      return 0;
    }
  },

  // --- Saving Data (Offline Supported) ---
  
  async appendTsv(filename: string, item: AudioItem, logName?: string) {
    const saveToOfflineQueue = async () => {
        console.log(`[Offline Fallback] Saving ${filename} locally...`);
        if (filename.includes("Correct")) {
             await offlineManager.addAction("SAVE_CORRECT", { item, logName: logName || filename });
        } else if (filename.includes("fail")) {
             await offlineManager.addAction("SAVE_FAIL", { item });
        }
    };

    if (!navigator.onLine) {
        await saveToOfflineQueue();
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/append-tsv`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename, item }),
        });
        if (!res.ok) throw new Error("Server error");
    } catch (err) {
        console.error("Online save failed, switching to offline queue:", err);
        await saveToOfflineQueue();
    }
  },

  async deleteTsvEntry(filename: string, key: string) {
    const saveToOfflineQueue = async () => {
         console.log(`[Offline Fallback] Deleting ${key} from ${filename} locally...`);
         await offlineManager.addAction("DELETE_ENTRY", { filename, key });
    };

    if (!navigator.onLine) {
         await saveToOfflineQueue();
         return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/delete-tsv-entry`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename, key }),
        });
        if (!res.ok) throw new Error("Server error");
    } catch (err) {
        console.error("Online delete failed, switching to offline queue:", err);
        await saveToOfflineQueue();
    }
  },

  async saveChangeLog(original: string, changed: string) {
     if (!navigator.onLine) return;
     try {
        await fetch(`${API_BASE}/api/append-change`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ original, changed }),
        });
     } catch (e) { console.warn("Failed to save changelog"); }
  },

  // --- NLP & Processing (Offline Supported) ---
  
  async tokenize(text: string): Promise<string[]> {
    if (!pyThaiNLPService.isReady()) {
        try { await pyThaiNLPService.init(); } catch {}
    }
    if (!pyThaiNLPService.isReady()) return text.split(' ');
    
    return pyThaiNLPService.tokenize(text);
  },

  async tokenizeBatch(texts: string[]): Promise<{ results: string[][] }> {
    if (!pyThaiNLPService.isReady()) {
        try { await pyThaiNLPService.init(); } catch {}
    }
    const results = texts.map(t => pyThaiNLPService.tokenize(t));
    return { results };
  },

  async scanAudio(path: string): Promise<string[]> {
    if (!navigator.onLine) return [];
    try {
        const res = await fetch(`${API_BASE}/api/scan-audio`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path }),
        });
        return await res.json();
    } catch { return []; }
  },

  // --- Misc ---
  async getAnnouncement(): Promise<{ text: string; timestamp: number; sender: string }> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1000);
      const res = await fetch(`${API_BASE}/api/announcement`, { signal: controller.signal });
      clearTimeout(id);
      return await res.json();
    } catch { return { text: "", timestamp: 0, sender: "" }; }
  },

  async sendAnnouncement(text: string, sender: string) {
    if (!navigator.onLine) return;
    try {
        await fetch(`${API_BASE}/api/announcement`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, sender }),
        });
    } catch {}
  },
  
  async fetchInitialData(employeeId: string) {
      if (!navigator.onLine) return null;
      try {
          const controller = new AbortController();
          const id = setTimeout(() => controller.abort(), 2000);
          const res = await fetch(`${API_BASE}/api/sync/initial-state?userId=${employeeId}`, { signal: controller.signal });
          clearTimeout(id);
          if(!res.ok) throw new Error("Sync failed");
          return await res.json();
      } catch (e) {
          console.warn("[Initial Load] Server unreachable, switching to offline cache.");
          return null;
      }
  },

  getAudioUrl(path: string): string {
    if (!path) return "";
    if (path.startsWith("blob:") || path.startsWith("http")) return path;
    return `${API_BASE}/api/audio?path=${encodeURIComponent(path)}`;
  }
};