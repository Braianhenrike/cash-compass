import { createClient } from "@supabase/supabase-js";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";
import type { Database } from "./types";

const memoryStorage = new Map<string, string>();

function resolveStorage(): Storage {
  if (typeof window === "undefined") {
    return {
      get length() {
        return memoryStorage.size;
      },
      clear() {
        memoryStorage.clear();
      },
      getItem(key) {
        return memoryStorage.get(key) ?? null;
      },
      key(index) {
        return Array.from(memoryStorage.keys())[index] ?? null;
      },
      removeItem(key) {
        memoryStorage.delete(key);
      },
      setItem(key, value) {
        memoryStorage.set(key, value);
      },
    };
  }

  try {
    const probeKey = "__cashcompass_storage_probe__";
    window.localStorage.setItem(probeKey, "ok");
    window.localStorage.removeItem(probeKey);
    return window.localStorage;
  } catch (error) {
    console.warn("LocalStorage indisponivel, usando armazenamento em memoria.", error);
    return {
      get length() {
        return memoryStorage.size;
      },
      clear() {
        memoryStorage.clear();
      },
      getItem(key) {
        return memoryStorage.get(key) ?? null;
      },
      key(index) {
        return Array.from(memoryStorage.keys())[index] ?? null;
      },
      removeItem(key) {
        memoryStorage.delete(key);
      },
      setItem(key, value) {
        memoryStorage.set(key, value);
      },
    };
  }
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: resolveStorage(),
    storageKey: "cashcompass-auth",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
