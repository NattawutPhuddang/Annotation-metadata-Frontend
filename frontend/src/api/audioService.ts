// src/api/audioService.ts
import { API_BASE } from './client';
import { AudioItem } from '../types';
import { offlineManager } from './OfflineManager'; // import เข้ามา

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 2000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

// เพิ่มฟังก์ชันสำหรับ Sync (จะถูกเรียกจาก Context หรือ App.tsx)
export const syncOfflineActions = async () => {
  if (!navigator.onLine) return;
  
  const queue = await offlineManager.getQueue();
  if (queue.length === 0) return;

  console.log(`[Sync] Processing ${queue.length} offline actions...`);

  // ยิง API ทีละตัว (หรือจะทำ Batch Endpoint ที่ Backend ก็ได้ แต่วิธีนี้ง่ายสุดไม่ต้องแก้ Backend เยอะ)
  for (const action of queue) {
    try {
      switch (action.type) {
        case "SAVE_CORRECT":
            // เรียกใช้ endpoint เดิมที่มีอยู่แล้ว
            await fetch(`${API_BASE}/api/append-tsv`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: "Correct.tsv", item: action.payload.item })
            });
            // บันทึก Log ส่วนตัวด้วย
            await fetch(`${API_BASE}/api/append-tsv`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: action.payload.logName, item: action.payload.item })
            });
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
      // ถ้า Error อาจจะเก็บไว้ Retry ทีหลัง หรือข้ามไปก่อน
    }
  }

  // เคลียร์คิวเมื่อเสร็จ
  await offlineManager.clearQueue();
  console.log("[Sync] Completed.");
};

export const audioService = {
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
    const res = await fetch(`${API_BASE}/api/move-to-trash`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, sourceFile }),
    });
    if (!res.ok) throw new Error('Failed to move to trash');
    return res.json();
  },

  async checkFileMtime(filename: string): Promise<number> {
    try {
      const res = await fetch(`${API_BASE}/api/check-mtime?filename=${filename}`);
      const data = await res.json();
      return data.mtime || 0;
    } catch {
      return 0;
    }
  },

  // --- Saving Data ---
  // --- Saving Data (Modified for Offline) ---
  async appendTsv(filename: string, item: AudioItem, logName?: string) {
    if (!navigator.onLine) {
        // 🔴 OFFLINE: ลง Queue
        console.log("[Offline] Queued save:", filename);
        if (filename.includes("Correct")) {
             await offlineManager.addAction("SAVE_CORRECT", { item, logName: logName || filename });
        } else if (filename.includes("fail")) {
             await offlineManager.addAction("SAVE_FAIL", { item });
        }
        return; // จบการทำงานเสมือนว่าเซฟเสร็จแล้ว
    }

    // 🟢 ONLINE: ยิงจริง
    await fetch(`${API_BASE}/api/append-tsv`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, item }),
    });
  },

  async deleteTsvEntry(filename: string, key: string) {
    if (!navigator.onLine) {
         // 🔴 OFFLINE: ลง Queue
        await offlineManager.addAction("DELETE_ENTRY", { filename, key });
         return;
    }

    // 🟢 ONLINE
    await fetch(`${API_BASE}/api/delete-tsv-entry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, key }),
    });
  },

  async saveChangeLog(original: string, changed: string) {
    await fetch(`${API_BASE}/api/append-change`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ original, changed }),
    });
  },

  // --- NLP & Processing ---
  async tokenize(text: string): Promise<string[]> {
    const res = await fetch(`${API_BASE}/api/tokenize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return await res.json();
  },

  async tokenizeBatch(texts: string[]): Promise<string[][]> {
    const res = await fetch(`${API_BASE}/api/tokenize-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts }),
    });
    return await res.json();
  },

  async scanAudio(path: string): Promise<string[]> {
    const res = await fetch(`${API_BASE}/api/scan-audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    return await res.json();
  },

  async getAnnouncement(): Promise<{ text: string; timestamp: number; sender: string }> {
    try {
      const res = await fetch(`${API_BASE}/api/announcement`);
      return await res.json();
    } catch {
      return { text: "", timestamp: 0, sender: "" };
    }
  },

  async sendAnnouncement(text: string, sender: string) {
    await fetch(`${API_BASE}/api/announcement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, sender }),
    });
  },async fetchInitialData(employeeId: string) {
      if (!navigator.onLine) return null;

      try {
          // 2. ยิง API แบบมี Timeout (2 วินาที)
          // ถ้า Server ดับ หรือ Connect ไม่ได้ มันจะ Error ตรงนี้ทันที ไม่รอจน Timeout ยาวๆ
          const res = await fetchWithTimeout(`${API_BASE}/api/sync/initial-state?userId=${employeeId}`, {}, 2000);
          
          if (!res.ok) throw new Error("Sync failed");
          return await res.json();
      } catch (e) {
          // 3. ถ้า Error (ไม่ว่าจะเน็ตหลุด, Server ดับ, หรือ Timeout)
          // ให้ return null เพื่อบอกให้ Frontend ไปใช้ข้อมูล Local แทน
          console.warn("[Initial Load] Server unreachable, switching to offline cache.");
          return null; 
      }
  },

  

  // --- Utils ---
  getAudioUrl(path: string): string {
    if (!path) return "";
    if (path.startsWith("blob:") || path.startsWith("http")) return path;
    return `${API_BASE}/api/audio?path=${encodeURIComponent(path)}`;
  }
};

