import sharp from 'sharp';

/**
 * Pre-OCR image preprocessing. Three goals, in order:
 *  1. Normalize against dark UI themes — Tesseract scores notably higher on
 *     dark-text-on-light-bg than the reverse, so we invert dark images.
 *  2. Upscale 2× — small UI text (12-14pt) is right at Tesseract's accuracy
 *     cliff; doubling pixel density consistently lifts recognition quality.
 *  3. Boost contrast — sharpens the boundary between glyphs and background,
 *     which makes anti-aliased pixels less likely to be mis-classified.
 *
 * Intentionally NOT doing: hard binarization (Otsu), which kills thin strokes
 * on Chinese-style fonts; aggressive denoise, which blurs small text.
 */
export async function preprocessForOcr(input: Buffer): Promise<Buffer> {
  const stats = await sharp(input).grayscale().stats();
  const meanLuma = stats.channels[0]?.mean ?? 128;
  const isDarkTheme = meanLuma < 128;

  const meta = await sharp(input).metadata();
  const targetWidth = (meta.width ?? 0) * 2;
  const targetHeight = (meta.height ?? 0) * 2;

  let pipeline = sharp(input).grayscale();

  if (isDarkTheme) {
    pipeline = pipeline.negate({ alpha: false });
  }

  if (targetWidth > 0 && targetHeight > 0) {
    pipeline = pipeline.resize({
      width: targetWidth,
      height: targetHeight,
      kernel: 'lanczos3',
      fit: 'fill',
    });
  }

  // linear(a, b) maps pixel `p` → `a*p + b`. 1.15 boosts contrast slightly,
  // -18 darkens the result to compensate so blacks stay near 0.
  pipeline = pipeline.linear(1.15, -18);

  return pipeline.png().toBuffer();
}
