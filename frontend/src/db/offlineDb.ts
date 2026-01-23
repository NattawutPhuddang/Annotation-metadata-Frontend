// src/db/offlineDb.ts
import Dexie, { Table } from 'dexie';
import { AudioItem } from '../types';

export interface OfflineLog {
  id?: number;
  action: 'CORRECT' | 'FAIL' | 'TRASH' | 'EDIT';
  filename: string;
  data: any;
  timestamp: number;
  synced: boolean;
}

export interface CachedAudio {
  filename: string;
  blob: Blob;
  createdAt: number;
}

class OfflineDatabase extends Dexie {
  logs!: Table<OfflineLog>;
  audioCache!: Table<CachedAudio>;

  constructor() {
    super('AudioAnnotationDB');
    this.version(1).stores({
      logs: '++id, action, filename, [synced+action]', // Index สำหรับค้นหา
      audioCache: 'filename' // Index สำหรับค้นหาไฟล์เสียง
    });
  }
}

export const db = new OfflineDatabase();