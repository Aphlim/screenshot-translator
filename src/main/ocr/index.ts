import { SOURCE_LANGUAGES, DEFAULT_SOURCE_LANGUAGE } from '@shared/channels';
import * as paddle from './paddleOcr';
import * as tesseract from './tesseract';

/**
 * Single OCR entry point. Routes to PaddleOCR (default for English + Chinese,
 * has a text-detection net that ignores most icons) or Tesseract.js (used for
 * Japanese / Korean today) based on the user's source-language choice.
 *
 * Each engine is lazy-loaded; switching languages just instantiates the new
 * engine on next call and reuses cached workers thereafter.
 */
export async function recognizeImage(
  pngBuffer: Buffer,
  sourceLanguageId?: string,
): Promise<string> {
  const id = sourceLanguageId ?? DEFAULT_SOURCE_LANGUAGE;
  const lang =
    SOURCE_LANGUAGES.find((l) => l.id === id) ??
    SOURCE_LANGUAGES.find((l) => l.id === DEFAULT_SOURCE_LANGUAGE)!;

  if (lang.engine === 'paddle') {
    return paddle.recognizeImage(pngBuffer);
  }
  return tesseract.recognizeImage(pngBuffer, lang.tesseractLangs ?? ['eng']);
}

export async function disposeOcr(): Promise<void> {
  await Promise.all([paddle.disposeOcr(), tesseract.disposeOcr()]);
}
