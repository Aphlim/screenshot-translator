import { BrowserWindow, ipcMain, shell } from 'electron';
import { dirname, join } from 'node:path';
import { is } from '@electron-toolkit/utils';
import {
  IpcChannel,
  PROMPT_PRESETS,
  DEFAULT_PROMPT_PRESET_ID,
  type SettingsPayload,
  type SettingsTestResult,
  type SettingsTranslate,
} from '@shared/channels';
import { loadConfig, saveConfig, getConfigPath } from '../config/store';
import { buildProvider } from '../translate';

let settingsWin: BrowserWindow | null = null;
let handlersRegistered = false;

/**
 * Open (or focus if already open) the settings window. Idempotent — calling
 * this while the window exists just brings it forward.
 */
export function openSettingsWindow(): BrowserWindow {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.show();
    settingsWin.focus();
    return settingsWin;
  }

  ensureHandlers();

  const win = new BrowserWindow({
    width: 460,
    height: 510,            // accommodates the new "翻译风格" preset section + banner
    show: false,
    frame: false,           // we render our own header
    transparent: false,     // shell now fills the window — no need for a transparent outer ring
    hasShadow: false,
    resizable: false,
    minimizable: true,
    maximizable: false,
    skipTaskbar: false,     // user expects to see settings in the taskbar
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

/** Register IPC handlers once for the lifetime of the app. */
function ensureHandlers(): void {
  if (handlersRegistered) return;
  handlersRegistered = true;

  ipcMain.handle(IpcChannel.SettingsGet, async () => {
    return await loadConfig();
  });

  ipcMain.handle(IpcChannel.SettingsSave, async (_e, payload: SettingsPayload) => {
    await saveConfig(payload);
    return { ok: true };
  });

  ipcMain.handle(
    IpcChannel.SettingsTestConnection,
    async (_e, cfg: SettingsTranslate): Promise<SettingsTestResult> => {
      try {
        // Use the default preset for the test prompt — just verifies network,
        // auth, and that the model accepts the request shape.
        const preset =
          PROMPT_PRESETS.find((p) => p.id === DEFAULT_PROMPT_PRESET_ID) ?? PROMPT_PRESETS[0];
        const provider = buildProvider(cfg, preset.systemPrompt);
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

  ipcMain.on(IpcChannel.SettingsOpenConfigFolder, () => {
    const folder = dirname(getConfigPath());
    shell.openPath(folder);
  });

  ipcMain.on(IpcChannel.SettingsClose, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.close();
  });
}
