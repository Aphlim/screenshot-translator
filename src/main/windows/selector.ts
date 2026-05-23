import { BrowserWindow, ipcMain, type Display } from 'electron';
import { join } from 'node:path';
import { is } from '@electron-toolkit/utils';
import { IpcChannel, type SelectionRect, type SelectorPayload } from '@shared/channels';

export interface SelectorResult {
  kind: 'confirm';
  rect: SelectionRect;
}
export interface SelectorCancelled {
  kind: 'cancel';
}
export type SelectorOutcome = SelectorResult | SelectorCancelled;

/**
 * Open a transparent fullscreen overlay covering `display`, push it the captured
 * screenshot to render as background, and resolve when the user either drags
 * a rectangle (→ confirm) or hits Esc / right-clicks (→ cancel).
 *
 * The window auto-closes after the outcome is delivered.
 */
export function openSelectorWindow(
  display: Display,
  screenshotPng: Buffer,
): Promise<SelectorOutcome> {
  return new Promise((resolve) => {
    const { x, y, width, height } = display.bounds;

    const win = new BrowserWindow({
      x,
      y,
      width,
      height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      hasShadow: false,
      fullscreen: false,        // don't go true-fullscreen — that messes with multi-monitor
      enableLargerThanScreen: true,
      focusable: true,
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/selector.js'),
        sandbox: false,
        backgroundThrottling: false,
      },
    });

    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true);

    let settled = false;
    const settle = (outcome: SelectorOutcome): void => {
      if (settled) return;
      settled = true;
      cleanup();
      if (!win.isDestroyed()) win.close();
      resolve(outcome);
    };

    const onReady = (event: Electron.IpcMainInvokeEvent): SelectorPayload | null => {
      if (event.sender !== win.webContents) return null;
      return {
        imageDataUrl: `data:image/png;base64,${screenshotPng.toString('base64')}`,
        width,
        height,
        scaleFactor: display.scaleFactor,
      };
    };

    const onConfirm = (
      event: Electron.IpcMainEvent,
      rect: SelectionRect,
    ): void => {
      if (event.sender !== win.webContents) return;
      settle({ kind: 'confirm', rect });
    };

    const onCancel = (event: Electron.IpcMainEvent): void => {
      if (event.sender !== win.webContents) return;
      settle({ kind: 'cancel' });
    };

    const cleanup = (): void => {
      ipcMain.removeHandler(IpcChannel.SelectorReady);
      ipcMain.removeListener(IpcChannel.SelectorConfirm, onConfirm);
      ipcMain.removeListener(IpcChannel.SelectorCancel, onCancel);
    };

    ipcMain.handle(IpcChannel.SelectorReady, onReady);
    ipcMain.on(IpcChannel.SelectorConfirm, onConfirm);
    ipcMain.on(IpcChannel.SelectorCancel, onCancel);

    win.on('closed', () => settle({ kind: 'cancel' }));
    win.on('blur', () => {
      // If user clicks away (focus stolen by another app's notification), bail.
      if (!settled) settle({ kind: 'cancel' });
    });

    win.once('ready-to-show', () => {
      win.show();
      win.focus();
    });

    const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
    if (is.dev && rendererUrl) {
      win.loadURL(`${rendererUrl}/selector.html`);
    } else {
      win.loadFile(join(__dirname, '../renderer/selector.html'));
    }
  });
}
