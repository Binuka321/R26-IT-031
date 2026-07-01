const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api";
const STORAGE_KEY = "post-flood-offline-queue";
const EVENT_NAME = "post-flood-offline-queue-change";

export type OfflineAction = {
  id: string;
  label: string;
  path: string;
  method: "POST" | "PUT" | "DELETE";
  body?: any;
  created_at: string;
  attempts: number;
  last_error?: string;
};

function getHeaders() {
  const token = localStorage.getItem("flood-user-token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function emitChange() {
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function getOfflineQueue(): OfflineAction[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue: OfflineAction[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  emitChange();
}

export function enqueueOfflineAction(action: Omit<OfflineAction, "id" | "created_at" | "attempts">) {
  const queue = getOfflineQueue();
  const queuedAction: OfflineAction = {
    ...action,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    created_at: new Date().toISOString(),
    attempts: 0,
  };
  saveOfflineQueue([...queue, queuedAction]);
  return queuedAction;
}

export function subscribeOfflineQueue(listener: () => void) {
  window.addEventListener(EVENT_NAME, listener);
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener(EVENT_NAME, listener);
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

export async function syncOfflineQueue() {
  if (!navigator.onLine) {
    return { synced: 0, failed: getOfflineQueue().length, online: false };
  }

  const queue = getOfflineQueue();
  const remaining: OfflineAction[] = [];
  let synced = 0;

  for (const action of queue) {
    try {
      const response = await fetch(`${API_BASE}${action.path}`, {
        method: action.method,
        headers: getHeaders(),
        body: action.body === undefined ? undefined : JSON.stringify(action.body),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || data.message || "Sync failed");
      }

      synced += 1;
    } catch (error: any) {
      remaining.push({
        ...action,
        attempts: action.attempts + 1,
        last_error: error.message || "Sync failed",
      });
    }
  }

  saveOfflineQueue(remaining);
  return { synced, failed: remaining.length, online: true };
}
