import { app } from 'electron';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createWorker, type Worker } from 'tesseract.js';
import { preprocessForOcr } from '../capture/preprocess';

/**
 * Tesseract.js wrapper used today for non-Chinese-non-English source languages
 * (Japanese, Korean). PaddleOCR handles en + zh as the default. Each unique
 * language combination gets its own cached worker so first-load (CDN download
 * of the language pack) is amortized.
 */

const workerCache = new Map<string, Promise<Worker>>();

async function getWorker(langs: string[]): Promise<Worker> {
  const key = [...langs].sort().join('+');
  let cached = workerCache.get(key);
  if (cached) return cached;

  const cacheDir = join(app.getPath('userData'), 'tesseract-cache');
  await mkdir(cacheDir, { recursive: true });

  cached = createWorker(langs, undefined, {
    cachePath: cacheDir,
    logger: () => {
      // silenced
    },
  });
  workerCache.set(key, cached);
  return cached;
}

interface OcrLine {
  text: string;
  confidence?: number;
}

const MIN_LINE_CONF = 55;

/**
 * Recognize text in the given image with the requested language packs.
 *
 * @param pngBuffer  PNG image bytes (cropped region from the screen).
 * @param langs      Tesseract language codes (e.g. ['jpn'], ['kor'], ['eng']).
 */
export async function recognizeImage(
  pngBuffer: Buffer,
  langs: string[] = ['eng'],
): Promise<string> {
  // Image preprocessing helps Tesseract more than PaddleOCR, especially on
  // small UI fonts and dark themes.
  const preprocessed = await preprocessForOcr(pngBuffer);

  const worker = await getWorker(langs);
  const { data } = await worker.recognize(preprocessed);

  const lines: OcrLine[] = ((data as { lines?: OcrLine[] }).lines ?? []);
  const cleaned = lines
    .filter((l) => (l.confidence ?? 100) >= MIN_LINE_CONF)
    .map((l) => (l.text ?? '').trim())
    .filter((t) => t.length > 0)
    .join('\n');

  console.log(`[ocr] tesseract(${langs.join('+')})`);
  console.log('[ocr] raw  :', JSON.stringify(data.text.trim().slice(0, 240)));
  console.log('[ocr] clean:', JSON.stringify(cleaned.slice(0, 240)));
  return cleaned;
}

export async function disposeOcr(): Promise<void> {
  for (const p of workerCache.values()) {
    try {
      const worker = await p;
      await worker.terminate();
    } catch {
      // ignore
    }
  }
  workerCache.clear();
}
