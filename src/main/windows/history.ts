import { BrowserWindow, ipcMain, clipboard } from 'electron';
import { join } from 'node:path';
import { is } from '@electron-toolkit/utils';
import { IpcChannel } from '@shared/channels';
import { getHistory, deleteHistoryEntry, clearHistory } from '../config/store';
import { iconPath } from '../iconPath';

let historyWin: BrowserWindow | null = null;
let handlersRegistered = false;

export function openHistoryWindow(): BrowserWindow {
  if (historyWin && !historyWin.isDestroyed()) {
    historyWin.show();
    historyWin.focus();
    return historyWin;
  }

  ensureHandlers();

  const win = new BrowserWindow({
    width: 720,
    height: 560,
    show: false,
    frame: false,
    transparent: false,
    hasShadow: false,
    resizable: true,
    minimizable: true,
    maximizable: true,
    skipTaskbar: false,
    icon: iconPath(128),
    backgroundColor: '#faf9f5',
    webPreferences: {
      preload: join(__dirname, '../preload/history.js'),
      sandbox: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  win.on('closed', () => {
    historyWin = null;
  });

  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (is.dev && rendererUrl) {
    win.loadURL(`${rendererUrl}/history.html`);
  } else {
    win.loadFile(join(__dirname, '../renderer/history.html'));
  }

  historyWin = win;
  return win;
}

function ensureHandlers(): void {
  if (handlersRegistered) return;
  handlersRegistered = true;

  ipcMain.handle(IpcChannel.HistoryGet, async () => {
    return await getHistory();
  });

  ipcMain.handle(IpcChannel.HistoryDeleteOne, async (_e, id: string) => {
    await deleteHistoryEntry(id);
    return { ok: true };
  });

  ipcMain.handle(IpcChannel.HistoryClear, async () => {
    await clearHistory();
    return { ok: true };
  });

  ipcMain.on(IpcChannel.HistoryCopy, (_e, text: string) => {
    clipboard.writeText(text);
  });

  ipcMain.on(IpcChannel.HistoryClose, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.close();
  });
}
