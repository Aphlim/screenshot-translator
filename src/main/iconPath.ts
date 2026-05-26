import { app } from 'electron';
import { join } from 'node:path';

/**
 * Resolve the absolute path to a bundled icon at the requested raster size.
 * The 256px PNG is the canonical app icon; the other sizes are used for the
 * system tray (16/24/32/48/64) and HiDPI window icons (128/512).
 */
export function iconPath(size: 16 | 24 | 32 | 48 | 64 | 128 | 256 | 512 = 256): string {
  const base = app.isPackaged
    ? process.resourcesPath
    : join(__dirname, '../../resources');
  const name = size === 256 ? 'icon.png' : `icon-${size}.png`;
  return join(base, name);
}
