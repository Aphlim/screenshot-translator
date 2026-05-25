import { captureDisplayUnderCursor } from './capture/screenshot';
import { cropRegion } from './capture/crop';
import { openSelectorWindow } from './windows/selector';
import { openPopupWindow, type PopupSession } from './windows/popup';
import { recognizeImage } from './ocr';
import { loadConfig, getConfigPath } from './config/store';
import { buildProvider } from './translate';
import { PROMPT_PRESETS, DEFAULT_PROMPT_PRESET_ID } from '@shared/channels';

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

    const config = await loadConfig();
    if (!config.translate?.apiKey || !config.translate?.baseURL || !config.translate?.model) {
      popup.update({
        status: 'error',
        original,
        message:
          `未配置翻译 API。\n请打开 "设置..."(托盘右键)填入配置。\n或手动编辑:\n${getConfigPath()}`,
      });
      return;
    }

    popup.update({ status: 'translating', original, model: config.translate.model });

    const presetId = config.promptPresetId ?? DEFAULT_PROMPT_PRESET_ID;
    const preset = PROMPT_PRESETS.find((p) => p.id === presetId) ?? PROMPT_PRESETS[0];
    const provider = buildProvider(config.translate, preset.systemPrompt);
    const trStart = Date.now();
    try {
      const translated = await provider.translate(original);
      const translateMs = Date.now() - trStart;
      console.log(`[orchestrator] translate ${translateMs}ms — ${translated.length} chars`);
      popup.update({
        status: 'done',
        original,
        translated,
        model: config.translate.model,
        translateMs,
      });
    } catch (err) {
      const e = err as Error & { status?: number };
      const msg = `${e.message ?? String(e)}` + (e.status ? ` (HTTP ${e.status})` : '');
      console.error('[orchestrator] translate error', err);
      popup.update({
        status: 'error',
        original,
        message: msg,
        model: config.translate.model,
      });
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
