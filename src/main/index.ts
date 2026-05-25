import { app, ipcMain } from 'electron';
import { electronApp } from '@electron-toolkit/utils';
import { DEFAULT_HOTKEY, IpcChannel } from '@shared/channels';
import { createTray, destroyTray } from './tray';
import { registerHotkey, unregisterAllHotkeys } from './hotkey';
import { runCapturePipeline } from './orchestrator';
import { disposeOcr } from './ocr';
import { openSettingsWindow } from './windows/settings';
import { loadConfig } from './config/store';

// Prevent two instances of the tray app from running at once. The second
// launch silently exits; the first instance can react via 'second-instance'.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function handleHotkey(): void {
  console.log('[hotkey] fired at', new Date().toISOString());
  void runCapturePipeline();
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.wangyazhuo.fuckenglish');

  ipcMain.handle(IpcChannel.Ping, () => 'pong');

  createTray({
    onTriggerCapture: handleHotkey,
    onOpenSettings: () => openSettingsWindow(),
  });

  // First-launch UX: if there's no API key configured, pop the settings window
  // immediately so the user knows what to do.
  void loadConfig().then((cfg) => {
    if (!cfg.translate?.apiKey) {
      openSettingsWindow();
    }
  });

  const ok = registerHotkey(DEFAULT_HOTKEY, handleHotkey);
  if (!ok) {
    console.error(`[hotkey] failed to register ${DEFAULT_HOTKEY} (taken by another app?)`);
  } else {
    console.log(`[hotkey] registered ${DEFAULT_HOTKEY}`);
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
