import { app, Menu, Tray, nativeImage } from 'electron';
import { join } from 'node:path';

let tray: Tray | null = null;

export interface TrayCallbacks {
  onTriggerCapture: () => void;
  onOpenSettings?: () => void;
}

export function createTray(callbacks: TrayCallbacks): Tray {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '../../resources/icon.png');

  const image = nativeImage.createFromPath(iconPath);
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);

  const menu = Menu.buildFromTemplate([
    {
      label: '截图翻译  (Ctrl+Alt+T)',
      click: () => callbacks.onTriggerCapture(),
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

  tray.setToolTip('FuckEnglish — 截图翻译 (Ctrl+Alt+T)');
  tray.setContextMenu(menu);

  // Left-click also triggers capture (Windows convention).
  tray.on('click', () => callbacks.onTriggerCapture());

  return tray;
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}
