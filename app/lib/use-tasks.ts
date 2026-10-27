"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ACTIVE_TASK_STORAGE_KEY,
  ACTIVE_TASK_UPDATED_EVENT,
  createTask as createTaskRecord,
  deleteTask as deleteTaskRecord,
  getTasks,
  isTaskStorageAvailable,
  readActiveTaskId,
  sortTasks,
  updateTask as updateTaskRecord,
  writeActiveTaskId,
  type Task,
  type TaskDraft,
} from "@/app/lib/tasks";

export interface UseTasksResult {
  tasks: Task[];
  /** False until the IndexedDB read settles; the sheet shows a loading hint. */
  ready: boolean;
  /** False when IndexedDB cannot be opened (private mode/quota). */
  storageAvailable: boolean;
  createTask: (draft: TaskDraft) => Promise<Task | null>;
  updateTask: (id: string, patch: Partial<TaskDraft>) => Promise<Task | null>;
  deleteTask: (id: string) => Promise<boolean>;
}

/**
 * Loads tasks from IndexedDB once and keeps the in-memory list in sync with
 * every write, so the list updates without a reload (F006/F007/F008).
 */
export function useTasks(): UseTasksResult {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ready, setReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [stored, available] = await Promise.all([
        getTasks(),
        isTaskStorageAvailable(),
      ]);

      if (cancelled) return;
      setTasks(stored);
      setStorageAvailable(available);
      setReady(true);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const create = useCallback(async (draft: TaskDraft) => {
    const task = await createTaskRecord(draft);
    if (task) {
      setTasks((current) => sortTasks([...current, task]));
    }
    return task;
  }, []);

  const update = useCallback(async (id: string, patch: Partial<TaskDraft>) => {
    const task = await updateTaskRecord(id, patch);
    if (task) {
      setTasks((current) =>
        sortTasks(current.map((item) => (item.id === task.id ? task : item))),
      );
    }
    return task;
  }, []);

  const remove = useCallback(async (id: string) => {
    const deleted = await deleteTaskRecord(id);
    if (deleted) {
      setTasks((current) => current.filter((task) => task.id !== id));
    }
    return deleted;
  }, []);

  return {
    tasks,
    ready,
    storageAvailable,
    createTask: create,
    updateTask: update,
    deleteTask: remove,
  };
}

/* -------------------------------------------------------------------------- */
/* Active task selection (F009)                                               */
/* -------------------------------------------------------------------------- */

let cachedRaw: string | null = null;
let cachedId: string | null = null;

function getActiveTaskSnapshot(): string | null {
  try {
    const raw = window.localStorage.getItem(ACTIVE_TASK_STORAGE_KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedId = readActiveTaskId();
    }
    return cachedId;
  } catch {
    return null;
  }
}

function getActiveTaskServerSnapshot(): string | null {
  return null;
}

function subscribeToActiveTask(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(ACTIVE_TASK_UPDATED_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(ACTIVE_TASK_UPDATED_EVENT, onStoreChange);
  };
}

/**
 * The task the next focus session is attributed to.
 *
 * `useSyncExternalStore` keeps the server render (no selection) and the first
 * client render identical, then swaps in the stored id without a
 * set-state-in-effect.
 */
export function useActiveTaskId(): [
  string | null,
  (id: string | null) => void,
] {
  const activeTaskId = useSyncExternalStore(
    subscribeToActiveTask,
    getActiveTaskSnapshot,
    getActiveTaskServerSnapshot,
  );

  const setActiveTaskId = useCallback((id: string | null) => {
    writeActiveTaskId(id);
  }, []);

  return [activeTaskId, setActiveTaskId];
}
