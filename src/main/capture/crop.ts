import sharp from 'sharp';
import type { SelectionRect } from '@shared/channels';

/**
 * Crop a region out of a PNG buffer.
 *
 * @param sourcePng Full-display screenshot as PNG bytes (at device resolution).
 * @param rectCss   Selection rectangle in CSS pixels (as drawn by the user).
 * @param scaleFactor Device pixel ratio of the display (e.g. 1.5 on 150% scale).
 *                    Used to map CSS px → device px so we crop at full sharpness.
 */
export async function cropRegion(
  sourcePng: Buffer,
  rectCss: SelectionRect,
  scaleFactor: number,
): Promise<Buffer> {
  // sharp's extract uses integer pixel coords on the source image. Convert CSS
  // px → device px, then clamp to image bounds to avoid out-of-range errors.
  const meta = await sharp(sourcePng).metadata();
  const imgW = meta.width ?? 0;
  const imgH = meta.height ?? 0;

  const left = Math.max(0, Math.round(rectCss.x * scaleFactor));
  const top = Math.max(0, Math.round(rectCss.y * scaleFactor));
  const width = Math.max(1, Math.min(imgW - left, Math.round(rectCss.width * scaleFactor)));
  const height = Math.max(1, Math.min(imgH - top, Math.round(rectCss.height * scaleFactor)));

  return await sharp(sourcePng).extract({ left, top, width, height }).png().toBuffer();
}
