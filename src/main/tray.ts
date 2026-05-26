import { Menu, Tray, nativeImage } from 'electron';
import { readFileSync } from 'node:fs';
import { iconPath } from './iconPath';
import { getCurrentHotkey } from './hotkey';
import { acceleratorToHumanLabel } from './hotkeyFormat';

let tray: Tray | null = null;
let currentCallbacks: TrayCallbacks | null = null;

export interface TrayCallbacks {
  onTriggerCapture: () => void;
  onOpenSettings?: () => void;
  onOpenHistory?: () => void;
}

function buildMenu(callbacks: TrayCallbacks): Menu {
  const hotkeyLabel = acceleratorToHumanLabel(getCurrentHotkey() ?? '');
  return Menu.buildFromTemplate([
    {
      label: `截图翻译${hotkeyLabel ? `  (${hotkeyLabel})` : ''}`,
      click: () => callbacks.onTriggerCapture(),
    },
    {
      label: '翻译历史',
      enabled: Boolean(callbacks.onOpenHistory),
      click: () => callbacks.onOpenHistory?.(),
    },
    {
      label: '设置…',
      enabled: Boolean(callbacks.onOpenSettings),
      click: () => callbacks.onOpenSettings?.(),
    },
    { type: 'separator' },
    {
      label: '退出 FuckEnglish',
      role: 'quit',
    },
  ]);
}

export function createTray(callbacks: TrayCallbacks): Tray {
  currentCallbacks = callbacks;
  // Tray icons render at 16-32px on Windows depending on DPI. Use the 32px
  // rasterization (with @2x = 64px on HiDPI) — Electron picks the best one.
  const image = nativeImage.createFromPath(iconPath(32));
  try {
    image.addRepresentation({
      scaleFactor: 2.0,
      buffer: readFileSync(iconPath(64)),
    });
  } catch {
    // If the @2x file is missing (e.g. older bundle), the @1x still works.
  }
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);

  tray.setContextMenu(buildMenu(callbacks));
  refreshTooltip();

  // Left-click also triggers capture (Windows convention).
  tray.on('click', () => callbacks.onTriggerCapture());

  return tray;
}

/** Re-render the tray menu — used after the hotkey is changed in settings. */
export function refreshTray(): void {
  if (!tray || !currentCallbacks) return;
  tray.setContextMenu(buildMenu(currentCallbacks));
  refreshTooltip();
}

function refreshTooltip(): void {
  if (!tray) return;
  const hotkeyLabel = acceleratorToHumanLabel(getCurrentHotkey() ?? '');
  tray.setToolTip(
    hotkeyLabel ? `FuckEnglish — 截图翻译 (${hotkeyLabel})` : 'FuckEnglish — 截图翻译',
  );
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
  currentCallbacks = null;
}
