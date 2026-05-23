import { desktopCapturer, screen, type Display } from 'electron';

export interface CapturedScreen {
  /** PNG-encoded bytes of the full display capture (at device resolution). */
  pngBuffer: Buffer;
  /** Display the screenshot belongs to. */
  display: Display;
}

/**
 * Capture the display the cursor is currently on. Returns the full screenshot
 * at native device resolution. desktopCapturer's `thumbnailSize` is what we
 * pass to control output resolution — we request the device pixel size so we
 * don't lose detail on HiDPI screens.
 */
export async function captureDisplayUnderCursor(): Promise<CapturedScreen> {
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);

  // Use the device-pixel dimensions for the thumbnail so the capture is sharp.
  const devicePixelWidth = Math.round(display.size.width * display.scaleFactor);
  const devicePixelHeight = Math.round(display.size.height * display.scaleFactor);

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: devicePixelWidth,
      height: devicePixelHeight,
    },
  });

  // Electron exposes one source per display. Match by display_id; fall back to
  // the first source if matching fails (some platforms don't populate it).
  const matched =
    sources.find((s) => s.display_id === String(display.id)) ?? sources[0];

  if (!matched) throw new Error('No screen source returned by desktopCapturer');

  const pngBuffer = matched.thumbnail.toPNG();
  return { pngBuffer, display };
}
