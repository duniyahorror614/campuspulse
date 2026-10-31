import { useState, useEffect, useRef, useCallback } from 'react';
import type { Notice } from '../../shared/schema.js';
import { NoticeStorage } from '../lib/storage.js';

export function useNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const storageRef = useRef<NoticeStorage | null>(null);

  useEffect(() => {
    const storage = new NoticeStorage(() => {
      setStorageWarning('Changes could not be saved to this browser (storage quota exceeded or private mode).');
    });
    storageRef.current = storage;

    const result = storage.loadFromLocalStorage();
    setNotices(result.notices);
    setIsLoaded(true);

    if (result.skippedCount > 0) {
      setStorageWarning(`${result.skippedCount} corrupted notice(s) were skipped during load.`);
    }
  }, []);

  const addNotice = useCallback((notice: Notice) => {
    if (!storageRef.current) return;
    storageRef.current.save(notice);
    setNotices(storageRef.current.getAll());
  }, []);

  const addNoticesBatch = useCallback((newNotices: Notice[]) => {
    if (!storageRef.current) return;
    storageRef.current.saveBatch(newNotices);
    setNotices(storageRef.current.getAll());
  }, []);

  const updateNotice = useCallback((updated: Notice) => {
    if (!storageRef.current) return;
    const noticeWithUpdate = {
      ...updated,
      updatedAt: new Date().toISOString(),
    };
    storageRef.current.save(noticeWithUpdate);
    setNotices(storageRef.current.getAll());
  }, []);

  const deleteNotice = useCallback((id: string): boolean => {
    if (!storageRef.current) return false;
    const ok = storageRef.current.delete(id);
    if (ok) {
      setNotices(storageRef.current.getAll());
    }
    return ok;
  }, []);

  const exportNotices = useCallback(() => {
    if (!storageRef.current) return;
    const jsonStr = storageRef.current.exportJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campus-pulse-notices-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const dismissStorageWarning = useCallback(() => {
    setStorageWarning(null);
  }, []);

  return {
    notices,
    isLoaded,
    storageWarning,
    addNotice,
    addNoticesBatch,
    updateNotice,
    deleteNotice,
    exportNotices,
    dismissStorageWarning,
  };
}
