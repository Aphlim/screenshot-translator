import { globalShortcut } from 'electron';

export type HotkeyHandler = () => void;

let currentAccelerator: string | null = null;
let currentHandler: HotkeyHandler | null = null;

/**
 * Register a global hotkey. Returns true on success. If the accelerator is
 * already taken by another app, Electron returns false silently — callers
 * should surface that to the user.
 */
export function registerHotkey(accelerator: string, handler: HotkeyHandler): boolean {
  if (globalShortcut.isRegistered(accelerator)) {
    globalShortcut.unregister(accelerator);
  }
  const ok = globalShortcut.register(accelerator, handler);
  if (ok) {
    currentAccelerator = accelerator;
    currentHandler = handler;
  }
  return ok;
}

/**
 * Atomically swap the registered hotkey. Tries the new one first; if it fails,
 * the old one is re-registered. Returns true if the new one took effect.
 */
export function replaceHotkey(newAccelerator: string): boolean {
  if (!currentHandler) return false;
  const previousAccelerator = currentAccelerator;

  if (previousAccelerator) {
    globalShortcut.unregister(previousAccelerator);
  }
  const ok = globalShortcut.register(newAccelerator, currentHandler);
  if (ok) {
    currentAccelerator = newAccelerator;
    return true;
  }
  // Recovery: put the old one back so the user isn't stranded with no hotkey.
  if (previousAccelerator) {
    globalShortcut.register(previousAccelerator, currentHandler);
    currentAccelerator = previousAccelerator;
  }
  return false;
}

export function unregisterAllHotkeys(): void {
  globalShortcut.unregisterAll();
  currentAccelerator = null;
}

export function getCurrentHotkey(): string | null {
  return currentAccelerator;
}
