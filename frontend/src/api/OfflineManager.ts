import localforage from "localforage";
// ไม่ต้อง import AudioItem แล้วใช้ any ไปก่อนหรือ import ให้ถูกต้องถ้าต้องการ type check

export interface OfflineAction {
  id: string;
  type: "SAVE_CORRECT" | "SAVE_FAIL" | "DELETE_ENTRY" | "SAVE_CHANGE";
  payload: any;
  timestamp: number;
}

const STORAGE_KEY = "offline_action_queue";

// Config ให้เก็บข้อมูลก้อนใหญ่ได้
localforage.config({
  name: "AudioAnnotationApp",
  storeName: "offline_store"
});

export const offlineManager = {
  // 1. เพิ่มคำสั่งลงคิว (Async)
  addAction: async (type: OfflineAction["type"], payload: any) => {
    const queue: OfflineAction[] = (await localforage.getItem(STORAGE_KEY)) || [];
    
    const action: OfflineAction = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      timestamp: Date.now(),
    };
    
    // Logic กรองอันเก่าออก
    const filteredQueue = queue.filter(q => {
        if (payload.filename && q.payload.filename === payload.filename) {
            return false; 
        }
        return true;
    });

    filteredQueue.push(action);
    await localforage.setItem(STORAGE_KEY, filteredQueue);
  },

  // 2. ดึงคิวทั้งหมด (Async)
  getQueue: async (): Promise<OfflineAction[]> => {
    return (await localforage.getItem(STORAGE_KEY)) || [];
  },

  // 3. ล้างคิว
  clearQueue: async () => {
    await localforage.removeItem(STORAGE_KEY);
  },

  // 4. เช็คว่ามีของค้างไหม
  hasPendingActions: async (): Promise<boolean> => {
    const queue: OfflineAction[] = (await localforage.getItem(STORAGE_KEY)) || [];
    return queue.length > 0;
  }
};