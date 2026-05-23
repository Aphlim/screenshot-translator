import { app } from 'electron';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface TranslateConfig {
  /** e.g. "https://api.deepseek.com" or "https://api.openai.com/v1" */
  baseURL: string;
  apiKey: string;
  /** e.g. "deepseek-chat", "gpt-4o-mini", "Qwen/Qwen2.5-7B-Instruct" */
  model: string;
}

export interface AppConfig {
  translate?: TranslateConfig;
  /** Reserved for phase 6 — currently hardcoded to Ctrl+Alt+T in channels.ts. */
  hotkey?: string;
}

function configPath(): string {
  return join(app.getPath('userData'), 'config.json');
}

let cached: AppConfig | null = null;

export async function loadConfig(): Promise<AppConfig> {
  if (cached) return cached;
  try {
    const raw = await readFile(configPath(), 'utf8');
    cached = JSON.parse(raw) as AppConfig;
    return cached;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      cached = {};
      return cached;
    }
    throw err;
  }
}

export async function saveConfig(next: AppConfig): Promise<void> {
  const p = configPath();
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(next, null, 2), 'utf8');
  cached = next;
}

export function getConfigPath(): string {
  return configPath();
}

export function clearConfigCache(): void {
  cached = null;
}
