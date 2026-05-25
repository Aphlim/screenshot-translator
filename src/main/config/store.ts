import { app } from 'electron';
import { join } from 'node:path';
// Type-only: electron-store v9+ is ESM. Loaded via dynamic import at runtime
// because the Electron main process bundle is CommonJS.
import type Store from 'electron-store';

export interface TranslateConfig {
  /** e.g. "https://api.deepseek.com" or "https://api.openai.com/v1" */
  baseURL: string;
  apiKey: string;
  /** e.g. "deepseek-chat", "gpt-4o-mini", "Qwen/Qwen2.5-7B-Instruct" */
  model: string;
}

export interface AppConfig {
  translate?: TranslateConfig;
  /** ID of the active prompt preset from PROMPT_PRESETS (default 'general'). */
  promptPresetId?: string;
  /** Reserved for v2 — currently hardcoded to Ctrl+Alt+T. */
  hotkey?: string;
  /** Reserved for v2 — currently always 'paddle'. */
  ocrEngine?: 'paddle' | 'tesseract';
}

let storePromise: Promise<Store<AppConfig>> | null = null;

async function getStore(): Promise<Store<AppConfig>> {
  if (!storePromise) {
    storePromise = (async () => {
      const mod = await import('electron-store');
      const StoreCtor = mod.default;
      return new StoreCtor<AppConfig>({
        // Path resolves to %APPDATA%/fuck-english/config.json on Windows,
        // matching what users may have created manually before phase 6.
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
