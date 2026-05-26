import { captureDisplayUnderCursor } from './capture/screenshot';
import { cropRegion } from './capture/crop';
import { openSelectorWindow } from './windows/selector';
import { openPopupWindow, type PopupSession } from './windows/popup';
import { recognizeImage } from './ocr';
import { loadConfig, getConfigPath, pushHistory } from './config/store';
import { buildProvider } from './translate';
import {
  PROMPT_PRESETS,
  DEFAULT_PROMPT_PRESET_ID,
  CUSTOM_PROMPT_PRESET_ID,
  TARGET_LANGUAGES,
  DEFAULT_TARGET_LANGUAGE,
  DEFAULT_SOURCE_LANGUAGE,
  type HistoryEntry,
} from '@shared/channels';

let inFlight = false;
let activePopup: PopupSession | null = null;

/**
 * Capture pipeline: hotkey → screenshot → user selects → popup opens
 * immediately in 'recognizing' state → OCR (engine routed by source language)
 * → translate (system prompt = preset with {target} substituted) → push 'done'.
 *
 * On success, an entry is appended to the persistent translation history.
 */
export async function runCapturePipeline(): Promise<void> {
  if (inFlight) {
    console.log('[orchestrator] capture already in progress, ignoring hotkey');
    return;
  }
  inFlight = true;

  activePopup?.dispose();
  activePopup = null;

  const pipelineStart = Date.now();

  try {
    const { pngBuffer, display } = await captureDisplayUnderCursor();

    const outcome = await openSelectorWindow(display, pngBuffer);
    if (outcome.kind === 'cancel') {
      console.log('[orchestrator] selection cancelled');
      return;
    }

    activePopup = openPopupWindow(outcome.rect, display, { status: 'recognizing' });
    const popup = activePopup;

    const cropped = await cropRegion(pngBuffer, outcome.rect, display.scaleFactor);
    const config = await loadConfig();
    const sourceLanguageId = config.sourceLanguage ?? DEFAULT_SOURCE_LANGUAGE;
    const targetLanguageId = config.targetLanguage ?? DEFAULT_TARGET_LANGUAGE;

    const ocrStart = Date.now();
    const original = await recognizeImage(cropped, sourceLanguageId);
    console.log(`[orchestrator] OCR ${Date.now() - ocrStart}ms — ${original.length} chars`);

    if (original.trim().length === 0) {
      popup.update({ status: 'error', message: '没有从图中识别到任何文本' });
      return;
    }

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

    // Resolve preset and target language → substitute {target} into the prompt.
    const presetId = config.promptPresetId ?? DEFAULT_PROMPT_PRESET_ID;
    const targetLang =
      TARGET_LANGUAGES.find((t) => t.id === targetLanguageId) ?? TARGET_LANGUAGES[0];
    let systemPromptTemplate: string;
    if (presetId === CUSTOM_PROMPT_PRESET_ID && config.customPrompt?.trim()) {
      systemPromptTemplate = config.customPrompt;
    } else {
      const fallback = presetId === CUSTOM_PROMPT_PRESET_ID ? PROMPT_PRESETS[0] : null;
      const preset = PROMPT_PRESETS.find((p) => p.id === presetId) ?? fallback ?? PROMPT_PRESETS[0];
      systemPromptTemplate = preset.systemPrompt;
    }
    const systemPrompt = systemPromptTemplate.replaceAll('{target}', targetLang.promptName);

    const provider = buildProvider(config.translate, systemPrompt);

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

      // Append to history on success.
      const entry: HistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        original,
        translated,
        sourceLanguage: sourceLanguageId,
        targetLanguage: targetLanguageId,
        presetId,
        model: config.translate.model,
        totalMs: Date.now() - pipelineStart,
      };
      await pushHistory(entry);
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
