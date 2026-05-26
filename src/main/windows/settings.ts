import { BrowserWindow, ipcMain, shell, globalShortcut } from 'electron';
import { dirname, join } from 'node:path';
import { is } from '@electron-toolkit/utils';
import {
  IpcChannel,
  PROMPT_PRESETS,
  DEFAULT_PROMPT_PRESET_ID,
  DEFAULT_HOTKEY,
  type SettingsPayload,
  type SettingsTestResult,
  type SettingsTranslate,
  type HotkeyRegisterResult,
} from '@shared/channels';
import { loadConfig, saveConfig, getConfigPath } from '../config/store';
import { buildProvider } from '../translate';
import { replaceHotkey } from '../hotkey';
import { refreshTray } from '../tray';
import { iconPath } from '../iconPath';

let settingsWin: BrowserWindow | null = null;
let handlersRegistered = false;

export function openSettingsWindow(): BrowserWindow {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    return settingsWin;
  }

  ensureHandlers();

  const win = new BrowserWindow({
    width: 460,
    height: 600,            // grew again for the new Hotkey + Languages sections
    show: false,
    frame: false,
    transparent: false,
    hasShadow: false,
    resizable: false,
    minimizable: true,
    maximizable: false,
    skipTaskbar: false,
    icon: iconPath(128),
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/settings.js'),
      sandbox: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  win.on('closed', () => {
    settingsWin = null;
  });

  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (is.dev && rendererUrl) {
    win.loadURL(`${rendererUrl}/settings.html`);
  } else {
    win.loadFile(join(__dirname, '../renderer/settings.html'));
  }

  settingsWin = win;
  return win;
}

function ensureHandlers(): void {
  if (handlersRegistered) return;
  handlersRegistered = true;

  ipcMain.handle(IpcChannel.SettingsGet, async () => {
    return await loadConfig();
  });

  ipcMain.handle(
    IpcChannel.SettingsSave,
    async (_e, payload: SettingsPayload): Promise<{ ok: boolean; hotkey?: HotkeyRegisterResult }> => {
      // Persist everything first.
      const existing = await loadConfig();
      const next = { ...existing, ...payload };
      await saveConfig(next);

      // If the hotkey changed, try to (re-)register it. Failure isn't fatal —
      // we surface it to the renderer so the user can pick another combo.
      let hotkeyRes: HotkeyRegisterResult | undefined;
      const newHotkey = payload.hotkey ?? DEFAULT_HOTKEY;
      const oldHotkey = existing.hotkey ?? DEFAULT_HOTKEY;
      if (newHotkey !== oldHotkey) {
        const ok = replaceHotkey(newHotkey);
        hotkeyRes = ok
          ? { ok: true }
          : { ok: false, message: `快捷键 ${newHotkey} 已被其他程序占用,已保留原快捷键 ${oldHotkey}` };
        refreshTray();
      }

      return { ok: true, hotkey: hotkeyRes };
    },
  );

  ipcMain.handle(
    IpcChannel.SettingsTestConnection,
    async (_e, cfg: SettingsTranslate): Promise<SettingsTestResult> => {
      try {
        const preset =
          PROMPT_PRESETS.find((p) => p.id === DEFAULT_PROMPT_PRESET_ID) ?? PROMPT_PRESETS[0];
        // For the smoke test we don't have a target language at this point, so
        // we substitute a benign value. The actual translate call at runtime
        // uses the user's chosen target.
        const systemPrompt = preset.systemPrompt.replaceAll('{target}', '简体中文');
        const provider = buildProvider(cfg, systemPrompt);
        const start = Date.now();
        await provider.translate('hello');
        return { ok: true, ms: Date.now() - start };
      } catch (err) {
        const e = err as Error & { status?: number };
        return {
          ok: false,
          message: e.message ?? String(e),
          status: e.status,
        };
      }
    },
  );

  ipcMain.handle(
    IpcChannel.SettingsCheckHotkey,
    async (_e, accelerator: string): Promise<HotkeyRegisterResult> => {
      // Briefly try to register a no-op handler to test if the accelerator
      // string is well-formed AND not taken. Caller is the renderer's hotkey
      // capture component — it uses this to give live feedback before save.
      try {
        if (globalShortcut.isRegistered(accelerator)) {
          // It's our own hotkey, which counts as available for the user.
          return { ok: true };
        }
        const ok = globalShortcut.register(accelerator, () => {});
        if (ok) {
          globalShortcut.unregister(accelerator);
          return { ok: true };
        }
        return { ok: false, message: '该组合已被占用或格式无效' };
      } catch (err) {
        return { ok: false, message: (err as Error).message };
      }
    },
  );

  ipcMain.on(IpcChannel.SettingsOpenConfigFolder, () => {
    const folder = dirname(getConfigPath());
    shell.openPath(folder);
  });

  ipcMain.on(IpcChannel.SettingsClose, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.close();
  });
}
