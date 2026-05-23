import { globalShortcut } from 'electron';

export type HotkeyHandler = () => void;

/**
 * Register a global hotkey. Returns true on success. If the accelerator is
 * already taken by another app, Electron returns false silently — callers
 * should surface that to the user (eventually in the settings page).
 */
export function registerHotkey(accelerator: string, handler: HotkeyHandler): boolean {
  if (globalShortcut.isRegistered(accelerator)) {
    globalShortcut.unregister(accelerator);
  }
  return globalShortcut.register(accelerator, handler);
}

export function unregisterAllHotkeys(): void {
  globalShortcut.unregisterAll();
}
