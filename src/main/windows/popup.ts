import { BrowserWindow, ipcMain, screen, type Display } from 'electron';
import { join } from 'node:path';
import { is } from '@electron-toolkit/utils';
import { IpcChannel, type PopupState, type SelectionRect } from '@shared/channels';

const POPUP_WIDTH = 640;
const POPUP_HEIGHT = 360;
const GAP = 10;

/**
 * A popup session owns one BrowserWindow and a mutable PopupState. The
 * orchestrator drives state updates; the popup renderer subscribes via IPC
 * and re-renders.
 */
export class PopupSession {
  private state: PopupState;
  private win: BrowserWindow;
  private readyHandler: (e: Electron.IpcMainInvokeEvent) => PopupState | null;
  private closeHandler: (e: Electron.IpcMainEvent) => void;
  private destroyed = false;

  constructor(initial: PopupState, win: BrowserWindow) {
    this.state = initial;
    this.win = win;

    this.readyHandler = (event) => {
      if (event.sender !== win.webContents) return null;
      return this.state;
    };
    this.closeHandler = (event) => {
      if (event.sender !== win.webContents) return;
      this.dispose();
    };

    ipcMain.handle(IpcChannel.PopupReady, this.readyHandler);
    ipcMain.on(IpcChannel.PopupClose, this.closeHandler);

    win.on('blur', () => this.dispose());
    win.on('closed', () => this.dispose());
  }

  update(patch: Partial<PopupState>): void {
    if (this.destroyed) return;
    this.state = { ...this.state, ...patch };
    if (!this.win.isDestroyed()) {
      this.win.webContents.send(IpcChannel.PopupUpdate, this.state);
    }
  }

  dispose(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    ipcMain.removeHandler(IpcChannel.PopupReady);
    ipcMain.removeListener(IpcChannel.PopupClose, this.closeHandler);
    if (!this.win.isDestroyed()) this.win.close();
  }
}

/**
 * Open the popup near the selection. Returns a PopupSession the orchestrator
 * uses to push state updates as OCR / translation complete.
 *
 * @param rect    User-drawn rectangle in selector-window-local CSS coords.
 * @param display The display the selection was made on.
 * @param initial Initial popup state (typically { status: 'recognizing' }).
 */
export function openPopupWindow(
  rect: SelectionRect,
  display: Display,
  initial: PopupState,
): PopupSession {
  const { x, y } = placePopup(rect, display, { width: POPUP_WIDTH, height: POPUP_HEIGHT });

  const win = new BrowserWindow({
    x,
    y,
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
    frame: false,
    transparent: false,          // shell fills the window — no shadow / no gutter
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    show: false,
    backgroundColor: '#faf9f5',
    webPreferences: {
      preload: join(__dirname, '../preload/popup.js'),
      sandbox: false,
    },
  });

  win.setAlwaysOnTop(true, 'pop-up-menu');

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  if (is.dev && rendererUrl) {
    win.loadURL(`${rendererUrl}/popup.html`);
  } else {
    win.loadFile(join(__dirname, '../renderer/popup.html'));
  }

  return new PopupSession(initial, win);
}

/**
 * Pick a position for the popup near the selection. Default: bottom-right of
 * the selection; flip horizontally / vertically if it would clip off the
 * display edge; center as a last resort.
 */
function placePopup(
  rect: SelectionRect,
  display: Display,
  size: { width: number; height: number },
): { x: number; y: number } {
  const { x: dx, y: dy, width: dw, height: dh } = display.bounds;
  const right = dx + rect.x + rect.width;
  const bottom = dy + rect.y + rect.height;
  const left = dx + rect.x;
  const top = dy + rect.y;

  // Default: just to the right of bottom-right corner of the selection.
  let x = right + GAP;
  let y = bottom + GAP;

  // Horizontal flip if it spills off the right edge.
  if (x + size.width > dx + dw) {
    x = left - GAP - size.width;
  }
  // If it also spills off the left edge, snap to the right edge with margin.
  if (x < dx) {
    x = dx + dw - size.width - GAP;
  }

  // Vertical flip if it spills off the bottom.
  if (y + size.height > dy + dh) {
    y = top - GAP - size.height;
  }
  if (y < dy) {
    y = dy + dh - size.height - GAP;
  }

  // Snap to the screen we actually intend to be on (paranoia for multi-display).
  const target = screen.getDisplayNearestPoint({ x: x + size.width / 2, y: y + size.height / 2 });
  if (target.id !== display.id) {
    x = dx + Math.round((dw - size.width) / 2);
    y = dy + Math.round((dh - size.height) / 2);
  }

  return { x: Math.round(x), y: Math.round(y) };
}
