import { captureDisplayUnderCursor } from './capture/screenshot';
import { cropRegion } from './capture/crop';
import { openSelectorWindow } from './windows/selector';
import { openPopupWindow, type PopupSession } from './windows/popup';
import { recognizeImage } from './ocr';
import { loadConfig, getConfigPath } from './config/store';
import { buildProvider } from './translate';

let inFlight = false;
let activePopup: PopupSession | null = null;

/**
 * Phase 5 pipeline: hotkey → screenshot → user selects → popup opens
 * immediately in 'recognizing' state → OCR pushes 'translating' → translate
 * pushes 'done' (or 'error'). Popup auto-positions near the selection and
 * closes on Esc / blur.
 */
export async function runCapturePipeline(): Promise<void> {
  if (inFlight) {
    console.log('[orchestrator] capture already in progress, ignoring hotkey');
    return;
  }
  inFlight = true;

  // Close any popup left over from the previous run before starting a new one.
  activePopup?.dispose();
  activePopup = null;

  try {
    const { pngBuffer, display } = await captureDisplayUnderCursor();

    const outcome = await openSelectorWindow(display, pngBuffer);
    if (outcome.kind === 'cancel') {
      console.log('[orchestrator] selection cancelled');
      return;
    }

    // Open the popup BEFORE OCR so the user gets immediate visual feedback.
    activePopup = openPopupWindow(outcome.rect, display, { status: 'recognizing' });
    const popup = activePopup;

    const cropped = await cropRegion(pngBuffer, outcome.rect, display.scaleFactor);

    const ocrStart = Date.now();
    const original = await recognizeImage(cropped);
    console.log(`[orchestrator] OCR ${Date.now() - ocrStart}ms — ${original.length} chars`);

    if (original.trim().length === 0) {
      popup.update({ status: 'error', message: '没有从图中识别到任何文本' });
      return;
    }

    popup.update({ status: 'translating', original });

    const config = await loadConfig();
    if (!config.translate?.apiKey || !config.translate?.baseURL || !config.translate?.model) {
      popup.update({
        status: 'error',
        original,
        message:
          `未配置翻译 API。\n请在此文件填写配置:\n${getConfigPath()}\n\n` +
          `(阶段 6 会做成图形化的设置窗,目前先手动改)`,
      });
      return;
    }

    const provider = buildProvider(config.translate);
    const trStart = Date.now();
    try {
      const translated = await provider.translate(original);
      console.log(`[orchestrator] translate ${Date.now() - trStart}ms — ${translated.length} chars`);
      popup.update({ status: 'done', original, translated });
    } catch (err) {
      const e = err as Error & { status?: number };
      const msg = `${e.message ?? String(e)}` + (e.status ? ` (HTTP ${e.status})` : '');
      console.error('[orchestrator] translate error', err);
      popup.update({ status: 'error', original, message: msg });
    }
  } catch (err) {
    console.error('[orchestrator] pipeline error', err);
    activePopup?.update({
      status: 'error',
      message: (err as Error).message ?? String(err),
    });
  } finally {
    inFlight = false;
  }
}
