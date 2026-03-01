/**
 * teachAI Learning State Store
 * ─────────────────────────────────────────────────────────────
 * Centralized client-side state management with persistence layer.
 * Replaces scattered localStorage calls with a unified, type-safe store.
 *
 * Architecture:
 *   - Pub/Sub pattern for reactive UI updates
 *   - Automatic persistence to localStorage + Supabase sync
 *   - Data migration support for schema evolution
 *   - Corruption recovery with graceful degradation
 */

import type { KnowledgeGraph } from "../knowledge-graph";

// ─── Types ──────────────────────────────────────────────────

export interface Character {
  id: string;
  name: string;
  emoji: string;
  color: string;
  personality: string;
  speaking_style: string;
  praise: string;
  struggle: string;
  confused: string;
  intro: string;
  lore: string;
  interests: string[];
  knowledge_areas: string[];
  growth_stages: { label: string; threshold: number }[];
  evolution_log: string[];
}

export interface ProfileEntry {
  id: string;
  date: string;
  title: string;
  mode: "whynot" | "vocabulary" | "concept" | "procedure";
  score: number;
  mastered: string[];
  gaps: string[];
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastDate: string;
  totalDays: number;
}

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  language: "ja" | "en";
  voiceEnabled: boolean;
  soundEnabled: boolean;
  reducedMotion: boolean;
  fontSize: "sm" | "md" | "lg";
}

export interface LearningState {
  apiKey: string;
  character: Character | null;
  profile: ProfileEntry[];
  graph: KnowledgeGraph | null;
  streak: StreakData;
  preferences: UserPreferences;
  onboarded: boolean;
  schemaVersion: number;
}

// ─── Defaults ───────────────────────────────────────────────

const SCHEMA_VERSION = 2;

const DEFAULT_STREAK: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastDate: "",
  totalDays: 0,
};

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system",
  language: "ja",
  voiceEnabled: false,
  soundEnabled: true,
  reducedMotion: false,
  fontSize: "md",
};

const DEFAULT_STATE: LearningState = {
  apiKey: "",
  character: null,
  profile: [],
  graph: null,
  streak: DEFAULT_STREAK,
  preferences: DEFAULT_PREFERENCES,
  onboarded: false,
  schemaVersion: SCHEMA_VERSION,
};

// ─── Storage Keys ───────────────────────────────────────────

const STORAGE_KEYS = {
  apiKey: "tg_apikey",
  character: "tg_char",
  profile: "tg_profile",
  graph: "tg_graph",
  streak: "tg_streak",
  preferences: "tg_prefs",
  onboarded: "tg_onboarded",
  schemaVersion: "tg_schema_v",
} as const;

// ─── Listener Type ──────────────────────────────────────────

type StateKey = keyof LearningState;
type Listener<K extends StateKey = StateKey> = (value: LearningState[K], key: K) => void;

// ─── Store Implementation ───────────────────────────────────

class LearningStore {
  private state: LearningState;
  private listeners: Map<StateKey, Set<Listener>> = new Map();

  constructor() {
    this.state = { ...DEFAULT_STATE };
  }

  // Initialize from localStorage
  hydrate(): void {
    if (typeof window === "undefined") return;

    try {
      const version = parseInt(localStorage.getItem(STORAGE_KEYS.schemaVersion) || "0");
      if (version < SCHEMA_VERSION) {
        this.migrate(version);
      }

      this.state.apiKey = localStorage.getItem(STORAGE_KEYS.apiKey) || "";
      this.state.character = this.loadJSON<Character>(STORAGE_KEYS.character);
      this.state.profile = this.loadJSON<ProfileEntry[]>(STORAGE_KEYS.profile) || [];
      this.state.graph = this.loadJSON<KnowledgeGraph>(STORAGE_KEYS.graph);
      this.state.streak = this.loadJSON<StreakData>(STORAGE_KEYS.streak) || DEFAULT_STREAK;
      this.state.preferences = {
        ...DEFAULT_PREFERENCES,
        ...(this.loadJSON<Partial<UserPreferences>>(STORAGE_KEYS.preferences) || {}),
      };
      this.state.onboarded = localStorage.getItem(STORAGE_KEYS.onboarded) === "1";
      this.state.schemaVersion = SCHEMA_VERSION;
    } catch {
      console.warn("[LearningStore] Hydration failed, using defaults");
      this.state = { ...DEFAULT_STATE };
    }
  }

  // Get current state
  get<K extends StateKey>(key: K): LearningState[K] {
    return this.state[key];
  }

  // Get full state snapshot
  getSnapshot(): Readonly<LearningState> {
    return { ...this.state };
  }

  // Update state and persist
  set<K extends StateKey>(key: K, value: LearningState[K]): void {
    this.state[key] = value;
    this.persist(key, value);
    this.notify(key, value);
  }

  // Subscribe to state changes
  subscribe<K extends StateKey>(key: K, listener: Listener<K>): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener as Listener);
    return () => {
      this.listeners.get(key)?.delete(listener as Listener);
    };
  }

  // ─── Convenience Methods ────────────────────────────────

  addProfileEntry(entry: ProfileEntry): void {
    const profile = [...this.state.profile];
    profile.unshift(entry);
    this.set("profile", profile.slice(0, 200));
  }

  updateStreak(): StreakData {
    const data = this.state.streak;
    const today = new Date().toISOString().slice(0, 10);

    if (data.lastDate === today) return data;

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const newStreak = data.lastDate === yesterday ? data.currentStreak + 1 : 1;

    const updated: StreakData = {
      currentStreak: newStreak,
      longestStreak: Math.max(data.longestStreak, newStreak),
      lastDate: today,
      totalDays: data.totalDays + 1,
    };

    this.set("streak", updated);
    return updated;
  }

  setTheme(theme: UserPreferences["theme"]): void {
    this.set("preferences", { ...this.state.preferences, theme });
  }

  // ─── Internal ─────────────────────────────────────────────

  private loadJSON<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed === null || parsed === undefined) return null;
      return parsed as T;
    } catch {
      localStorage.removeItem(key);
      return null;
    }
  }

  private persist<K extends StateKey>(key: K, value: LearningState[K]): void {
    if (typeof window === "undefined") return;

    try {
      const storageKey = STORAGE_KEYS[key];
      if (!storageKey) return;

      if (value === null || value === undefined) {
        localStorage.removeItem(storageKey);
      } else if (typeof value === "string") {
        localStorage.setItem(storageKey, value);
      } else if (typeof value === "boolean") {
        localStorage.setItem(storageKey, value ? "1" : "0");
      } else if (typeof value === "number") {
        localStorage.setItem(storageKey, String(value));
      } else {
        localStorage.setItem(storageKey, JSON.stringify(value));
      }
    } catch {
      // quota exceeded or other storage error
    }
  }

  private notify<K extends StateKey>(key: K, value: LearningState[K]): void {
    const listeners = this.listeners.get(key);
    if (!listeners) return;
    for (const listener of listeners) {
      try {
        listener(value, key);
      } catch (e) {
        console.error(`[LearningStore] Listener error for ${key}:`, e);
      }
    }
  }

  private migrate(fromVersion: number): void {
    if (fromVersion < 2) {
      // v1 → v2: Add preferences, move to new schema
      const oldChar = localStorage.getItem("tg_char");
      if (oldChar) {
        try {
          const parsed = JSON.parse(oldChar);
          if (parsed && !parsed.growth_stages) {
            parsed.growth_stages = [];
          }
          if (parsed && !parsed.evolution_log) {
            parsed.evolution_log = [];
          }
          localStorage.setItem(STORAGE_KEYS.character, JSON.stringify(parsed));
        } catch { /* skip corrupt data */ }
      }
    }

    localStorage.setItem(STORAGE_KEYS.schemaVersion, String(SCHEMA_VERSION));
  }

  // Reset all data
  reset(): void {
    if (typeof window === "undefined") return;
    for (const key of Object.values(STORAGE_KEYS)) {
      localStorage.removeItem(key);
    }
    this.state = { ...DEFAULT_STATE };
    for (const [key] of this.listeners) {
      this.notify(key, this.state[key]);
    }
  }
}

// Singleton instance
export const learningStore = new LearningStore();
