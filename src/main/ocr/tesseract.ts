import { app } from 'electron';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createWorker, type Worker } from 'tesseract.js';
import { preprocessForOcr } from '../capture/preprocess';

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    const cacheDir = join(app.getPath('userData'), 'tesseract-cache');
    await mkdir(cacheDir, { recursive: true });
    // Loading chi_sim alongside eng lets Tesseract classify Chinese characters
    // *as Chinese* instead of forcing them into garbled Latin. We then drop
    // CJK words in post-processing (we only translate English here).
    workerPromise = createWorker(['eng', 'chi_sim'], undefined, {
      cachePath: cacheDir,
      logger: () => {
        // silenced; orchestrator times the call
      },
    });
  }
  return workerPromise;
}

interface OcrWord {
  text: string;
  confidence?: number;
}
interface OcrLine {
  text: string;
  confidence?: number;
  words?: OcrWord[];
}

const CJK_RE = /[　-〿぀-ヿ㐀-䶿一-鿿豈-﫿＀-￯]/;

// Per-word confidence threshold. Real English UI text scores 80-95; icon
// mis-reads and noise typically score below 75.
const MIN_WORD_CONF = 72;

export async function recognizeImage(pngBuffer: Buffer): Promise<string> {
  const preprocessed = await preprocessForOcr(pngBuffer);
  const worker = await getWorker();
  const { data } = await worker.recognize(preprocessed);

  const lines: OcrLine[] = (data as { lines?: OcrLine[] }).lines ?? [];
  const cleaned =
    lines.length > 0
      ? buildEnglishOnly(lines)
      : data.text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && !CJK_RE.test(l))
          .join('\n');

  console.log('[ocr] raw  :', JSON.stringify(data.text.trim().slice(0, 240)));
  console.log('[ocr] clean:', JSON.stringify(cleaned.slice(0, 240)));
  return cleaned;
}

/**
 * Three-pass word-level filter:
 *  - Drop entire lines that are majority CJK (Chinese paragraphs we don't translate).
 *  - For surviving lines, keep only words whose Tesseract confidence ≥ MIN_WORD_CONF
 *    AND that contain no CJK characters.
 *  - Apply a final token-shape filter to catch high-confidence icon mis-reads
 *    that slipped through (single-symbol tokens, weird short strings).
 */
function buildEnglishOnly(lines: OcrLine[]): string {
  const out: string[] = [];
  let prevWasBlank = false;

  for (const line of lines) {
    const lineText = line.text ?? '';
    if (lineText.trim().length === 0) {
      if (out.length > 0 && !prevWasBlank) {
        out.push('');
        prevWasBlank = true;
      }
      continue;
    }

    // Drop the whole line if it's mostly Chinese (or other CJK).
    const cjkChars = (lineText.match(new RegExp(CJK_RE.source, 'g')) ?? []).length;
    const latinChars = (lineText.match(/[A-Za-z]/g) ?? []).length;
    if (cjkChars > latinChars) continue;

    const words: OcrWord[] = line.words ?? [];
    const kept: string[] = [];
    for (const w of words) {
      const text = w.text?.trim() ?? '';
      if (text.length === 0) continue;
      if ((w.confidence ?? 100) < MIN_WORD_CONF) continue;
      if (CJK_RE.test(text)) continue;
      if (isTokenNoise(text)) continue;
      kept.push(text);
    }

    if (kept.length === 0) continue;
    out.push(kept.join(' '));
    prevWasBlank = false;
  }

  return out.join('\n').trim();
}

/**
 * Last-line defense against icon mis-reads that scored high confidence.
 * Conservative: only flags tokens that are very clearly not English words.
 */
function isTokenNoise(token: string): boolean {
  // Single-letter token with punctuation attached (e.g. "O)", "A]").
  // Real "I." and "a." (sentence enders) are bare letters, not letter+bracket.
  if (/^[A-Za-z][)\](}>]$/.test(token)) return true;
  if (/^[([{<][A-Za-z]$/.test(token)) return true;

  // Short token that's mostly non-alphanumeric (e.g. "3=", "<>", "+", "%%").
  if (token.length <= 3) {
    const alnum = (token.match(/[A-Za-z0-9]/g) ?? []).length;
    if (alnum === 0) return true;
    if (alnum / token.length < 0.5) return true;
  }

  // Many letters but no vowels — typical of CJK glyphs mis-read as Latin
  // when the chi_sim model wasn't loaded for a region. Conservative threshold.
  const letters = (token.match(/[A-Za-z]/g) ?? []).length;
  if (letters >= 5) {
    const vowels = (token.match(/[aeiouAEIOU]/g) ?? []).length;
    if (vowels === 0) return true;
  }

  return false;
}

export async function disposeOcr(): Promise<void> {
  if (workerPromise) {
    try {
      const worker = await workerPromise;
      await worker.terminate();
    } catch {
      // ignore
    }
    workerPromise = null;
  }
}
