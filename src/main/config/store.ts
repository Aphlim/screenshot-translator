import { app } from 'electron';
import { join } from 'node:path';
// Type-only: electron-store v9+ is ESM. Loaded via dynamic import at runtime
// because the Electron main process bundle is CommonJS.
import type Store from 'electron-store';
import type { HistoryEntry } from '@shared/channels';
import { HISTORY_MAX } from '@shared/channels';

export interface TranslateConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface AppConfig {
  translate?: TranslateConfig;
  promptPresetId?: string;
  /** User-defined system prompt; used when promptPresetId === 'custom'. */
  customPrompt?: string;
  /** Electron accelerator (e.g. "CommandOrControl+J"). */
  hotkey?: string;
  /** Source language id; drives OCR engine selection. */
  sourceLanguage?: string;
  /** Target language id; substituted into the prompt template. */
  targetLanguage?: string;
  /** Translation history (FIFO, capped at HISTORY_MAX). */
  history?: HistoryEntry[];
  /** Reserved for v2 — currently always 'paddle' (when sourceLanguage routes there). */
  ocrEngine?: 'paddle' | 'tesseract';
}

let storePromise: Promise<Store<AppConfig>> | null = null;

async function getStore(): Promise<Store<AppConfig>> {
  if (!storePromise) {
    storePromise = (async () => {
      const mod = await import('electron-store');
      const StoreCtor = mod.default;
      return new StoreCtor<AppConfig>({
        name: 'config',
        defaults: {},
        clearInvalidConfig: true,
      });
    })();
  }
  return storePromise;
}

export async function loadConfig(): Promise<AppConfig> {
  const store = await getStore();
  return store.store;
}

export async function saveConfig(next: AppConfig): Promise<void> {
  const store = await getStore();
  store.store = next;
}

export async function patchConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
  const store = await getStore();
  const merged = { ...store.store, ...patch };
  store.store = merged;
  return merged;
}

export function getConfigPath(): string {
  return join(app.getPath('userData'), 'config.json');
}

// --- History helpers (separate so the orchestrator doesn't shuffle full configs around) ---

export async function getHistory(): Promise<HistoryEntry[]> {
  const cfg = await loadConfig();
  return cfg.history ?? [];
}

export async function pushHistory(entry: HistoryEntry): Promise<void> {
  const store = await getStore();
  const current = store.store.history ?? [];
  // Newest first, capped at HISTORY_MAX (oldest dropped).
  const next = [entry, ...current].slice(0, HISTORY_MAX);
  store.store = { ...store.store, history: next };
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const store = await getStore();
  const current = store.store.history ?? [];
  store.store = { ...store.store, history: current.filter((e) => e.id !== id) };
}

export async function clearHistory(): Promise<void> {
  const store = await getStore();
  store.store = { ...store.store, history: [] };
}
