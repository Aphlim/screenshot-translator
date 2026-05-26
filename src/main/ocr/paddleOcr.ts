// Type-only import: `@gutenye/ocr-node` is ESM-only, but Electron's main
// process bundle is CommonJS. `import type` is a TS construct that emits no
// runtime code; the actual module is loaded via dynamic `import()` below.
import type OcrLib from '@gutenye/ocr-node';
import path from 'node:path';
import { app } from 'electron';
import { stripIconNoise, isLikelyNoise } from './cleanup';

type OcrInstance = Awaited<ReturnType<typeof OcrLib.create>>;

let ocrPromise: Promise<OcrInstance> | null = null;

/**
 * Locate the @gutenye/ocr-models assets directory. The library's default
 * resolver uses `import.meta.url` of its own JS file, which inside a packaged
 * Electron build points at `app.asar/...`. But onnxruntime-node is a native
 * module and can't read files from inside an asar archive, so we list the
 * models under electron-builder's `asarUnpack`, which mirrors them to
 * `app.asar.unpacked/`. Rewrite the path accordingly.
 *
 * In dev mode `app.getAppPath()` returns the project root with no `.asar`
 * suffix, so the suffix branch is skipped and the original path works.
 */
function resolveModelsDir(): string {
  const appPath = app.getAppPath();
  const base = appPath.endsWith('app.asar') ? `${appPath}.unpacked` : appPath;
  return path.join(base, 'node_modules', '@gutenye', 'ocr-models', 'assets');
}

async function getOcr(): Promise<OcrInstance> {
  if (!ocrPromise) {
    const mod = await import('@gutenye/ocr-node');
    const modelsDir = resolveModelsDir();
    // Pass explicit paths so the library doesn't fall back to its
    // import.meta.url-based resolver (which yields an app.asar/ path that
    // native modules can't open).
    ocrPromise = mod.default.create({
      models: {
        detectionPath: path.join(modelsDir, 'ch_PP-OCRv4_det_infer.onnx'),
        recognitionPath: path.join(modelsDir, 'ch_PP-OCRv4_rec_infer.onnx'),
        dictionaryPath: path.join(modelsDir, 'ppocr_keys_v1.txt'),
      },
    });
  }
  return ocrPromise;
}

/**
 * Actual return shape of `ocr.detect()` — derived from
 * @gutenye/ocr-common/build/types/types.d.ts (the published .d.ts on the
 * wrapper is `Promise<any>`, but the underlying type is `Line[]`).
 */
interface Line {
  text: string;
  /** Confidence score in [0, 1]; PaddleOCR's mean per-character probability. */
  mean: number;
  /** Polygon: 4 corners as [[x, y], …]. May be missing on synthetic inputs. */
  box?: number[][];
}

const CJK_RE = /[　-〿぀-ヿ㐀-䶿一-鿿豈-﫿＀-￯]/;
const MIN_SCORE = 0.55;

export async function recognizeImage(pngBuffer: Buffer): Promise<string> {
  const ocr = await getOcr();
  // ocr.detect() forwards its argument to `sharp()` internally, so a raw PNG
  // buffer works (sharp decodes it). The TS signature says `string` but the
  // runtime accepts anything sharp accepts.
  const lines = (await (ocr as { detect: (input: Buffer) => Promise<Line[]> }).detect(
    pngBuffer,
  )) ?? [];

  const cleaned = postprocess(lines);

  console.log(`[ocr] paddle detected ${lines.length} region(s)`);
  console.log('[ocr] raw  :', JSON.stringify(lines.map((l) => l.text).join(' | ').slice(0, 240)));
  console.log('[ocr] clean:', JSON.stringify(cleaned.slice(0, 240)));

  return cleaned;
}

function topOf(line: Line): number {
  if (!line.box || line.box.length === 0) return 0;
  return Math.min(...line.box.map((p) => p[1] ?? 0));
}
function leftOf(line: Line): number {
  if (!line.box || line.box.length === 0) return 0;
  return Math.min(...line.box.map((p) => p[0] ?? 0));
}
function heightOf(line: Line): number {
  if (!line.box || line.box.length === 0) return 20;
  const ys = line.box.map((p) => p[1] ?? 0);
  return Math.max(...ys) - Math.min(...ys) || 20;
}

/**
 * Drop low-confidence regions, drop regions that are mostly CJK (we only
 * translate English here), then reassemble into reading order: top-to-bottom,
 * left-to-right, grouping regions on the same horizontal band into one line.
 *
 * PaddleOCR's detection network already excludes icons most of the time —
 * icons don't satisfy the "text-like region" criterion the model was trained
 * for. So we don't need the heavy token-shape heuristics Tesseract required.
 */
function postprocess(lines: Line[]): string {
  const eligible = lines.filter((l) => {
    if ((l.mean ?? 0) < MIN_SCORE) return false;

    const trimmed = l.text.trim();
    if (trimmed.length === 0) return false;

    const latin = (trimmed.match(/[A-Za-z]/g) ?? []).length;
    if (latin === 0) return false;

    const cjk = (trimmed.match(new RegExp(CJK_RE.source, 'g')) ?? []).length;
    if (cjk > latin) return false;

    return true;
  });

  if (eligible.length === 0) return '';

  const sorted = [...eligible].sort((a, b) => {
    const tA = topOf(a);
    const tB = topOf(b);
    const threshold = ((heightOf(a) + heightOf(b)) / 2) * 0.4;
    if (Math.abs(tA - tB) > threshold) return tA - tB;
    return leftOf(a) - leftOf(b);
  });

  const groups: Line[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const grp = groups[groups.length - 1];
    const anchor = grp[0];
    const threshold = ((heightOf(cur) + heightOf(anchor)) / 2) * 0.4;
    if (Math.abs(topOf(cur) - topOf(anchor)) <= threshold) {
      grp.push(cur);
    } else {
      groups.push([cur]);
    }
  }

  // Assemble each line, then apply token-level cleanup and a line-level
  // noise heuristic. PaddleOCR's text-detection network filters most icons,
  // but icon shapes that look enough like glyphs (chat bubble → "O)", lightning
  // → "4", briefcase → "6") still survive — these cleanups catch them.
  const assembledLines = groups
    .map((g) => g.map((l) => l.text.trim()).join(' '))
    .map((line) => stripIconNoise(line))
    .filter((line) => line.length > 0 && !isLikelyNoise(line));

  return assembledLines.join('\n');
}

export async function disposeOcr(): Promise<void> {
  // PaddleOCR ONNX sessions GC naturally when the process exits.
  ocrPromise = null;
}
