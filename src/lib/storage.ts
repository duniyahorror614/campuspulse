import { Notice, NoticeSchema } from '../../shared/schema.js';

export const STORAGE_KEY = 'campusPulse.notices.v1';

export interface StorageLoadResult {
  notices: Notice[];
  skippedCount: number;
}

export class NoticeStorage {
  private inMemoryMap: Map<string, Notice> = new Map();
  private hashSet: Set<string> = new Set();
  private isStorageAvailable = true;
  private pendingWriteTimer: ReturnType<typeof setTimeout> | null = null;
  private onQuotaErrorCallback: (() => void) | null = null;

  constructor(onQuotaError?: () => void) {
    if (onQuotaError) {
      this.onQuotaErrorCallback = onQuotaError;
    }
    this.loadFromLocalStorage();
  }

  public setQuotaErrorCallback(cb: () => void): void {
    this.onQuotaErrorCallback = cb;
  }

  public loadFromLocalStorage(): StorageLoadResult {
    this.inMemoryMap.clear();
    this.hashSet.clear();
    let skippedCount = 0;

    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const result = NoticeSchema.safeParse(item);
            if (result.success) {
              this.inMemoryMap.set(result.data.id, result.data);
              if (result.data.contentHash) {
                this.hashSet.add(result.data.contentHash);
              }
            } else {
              skippedCount++;
            }
          }
        }
      }
    } catch {
      // LocalStorage access denied or JSON corrupted
      this.isStorageAvailable = false;
    }

    return {
      notices: this.getAll(),
      skippedCount,
    };
  }

  public getAll(): Notice[] {
    return Array.from(this.inMemoryMap.values());
  }

  public getById(id: string): Notice | undefined {
    return this.inMemoryMap.get(id);
  }

  public hasContentHash(hash: string): boolean {
    return this.hashSet.has(hash);
  }

  public getExistingByHash(hash: string): Notice | undefined {
    if (!this.hashSet.has(hash)) return undefined;
    for (const notice of this.inMemoryMap.values()) {
      if (notice.contentHash === hash) return notice;
    }
    return undefined;
  }

  public save(notice: Notice): void {
    this.inMemoryMap.set(notice.id, notice);
    if (notice.contentHash) {
      this.hashSet.add(notice.contentHash);
    }
    this.scheduleBatchWrite();
  }

  public saveBatch(notices: Notice[]): void {
    for (const n of notices) {
      this.inMemoryMap.set(n.id, n);
      if (n.contentHash) {
        this.hashSet.add(n.contentHash);
      }
    }
    this.scheduleBatchWrite();
  }

  public delete(id: string): boolean {
    const notice = this.inMemoryMap.get(id);
    if (!notice) return false;

    this.inMemoryMap.delete(id);
    // Recompute hash set to stay consistent
    this.hashSet.clear();
    for (const n of this.inMemoryMap.values()) {
      if (n.contentHash) this.hashSet.add(n.contentHash);
    }

    this.scheduleBatchWrite();
    return true;
  }

  private scheduleBatchWrite(): void {
    if (this.pendingWriteTimer) {
      clearTimeout(this.pendingWriteTimer);
    }

    this.pendingWriteTimer = setTimeout(() => {
      this.flushToLocalStorage();
    }, 150);
  }

  public flushToLocalStorage(): boolean {
    if (typeof window === 'undefined') return false;

    try {
      const data = JSON.stringify(Array.from(this.inMemoryMap.values()));
      window.localStorage.setItem(STORAGE_KEY, data);
      this.isStorageAvailable = true;
      return true;
    } catch {
      this.isStorageAvailable = false;
      if (this.onQuotaErrorCallback) {
        this.onQuotaErrorCallback();
      }
      return false;
    }
  }

  public isStorageWorking(): boolean {
    return this.isStorageAvailable;
  }

  public exportJson(): string {
    return JSON.stringify(this.getAll(), null, 2);
  }
}
