import { app, ipcMain } from 'electron';
import { electronApp } from '@electron-toolkit/utils';
import { DEFAULT_HOTKEY, IpcChannel } from '@shared/channels';
import { createTray, destroyTray } from './tray';
import { registerHotkey, unregisterAllHotkeys } from './hotkey';
import { runCapturePipeline } from './orchestrator';
import { disposeOcr } from './ocr';
import { openSettingsWindow } from './windows/settings';
import { openHistoryWindow } from './windows/history';
import { loadConfig } from './config/store';

// Prevent two instances of the tray app from running at once.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function handleHotkey(): void {
  console.log('[hotkey] fired at', new Date().toISOString());
  void runCapturePipeline();
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.aphlim.kuangyi');

  ipcMain.handle(IpcChannel.Ping, () => 'pong');

  createTray({
    onTriggerCapture: handleHotkey,
    onOpenSettings: () => openSettingsWindow(),
    onOpenHistory: () => openHistoryWindow(),
  });

  // Load config to determine which hotkey to register AND whether to auto-open
  // settings (first-launch). Do this synchronously so the hotkey is bound
  // before the user has any chance to press it.
  const cfg = await loadConfig();
  const accelerator = cfg.hotkey ?? DEFAULT_HOTKEY;
  const ok = registerHotkey(accelerator, handleHotkey);
  if (!ok) {
    console.error(`[hotkey] failed to register ${accelerator} — falling back to default`);
    // Try the bundled default as a last resort so the user always has *some* hotkey.
    if (accelerator !== DEFAULT_HOTKEY) {
      registerHotkey(DEFAULT_HOTKEY, handleHotkey);
    }
  } else {
    console.log(`[hotkey] registered ${accelerator}`);
  }

  if (!cfg.translate?.apiKey) {
    openSettingsWindow();
  }

  // Keep the dock/taskbar clean — we're a background tray app.
  app.dock?.hide();
});

app.on('second-instance', () => {
  // Could surface a notification here; for MVP we silently ignore.
});

app.on('will-quit', () => {
  unregisterAllHotkeys();
  destroyTray();
  void disposeOcr();
});

// IMPORTANT: do NOT call app.quit() on 'window-all-closed' — we are a
// tray-only app and have zero windows during idle.
app.on('window-all-closed', () => {
  // intentionally empty
});
