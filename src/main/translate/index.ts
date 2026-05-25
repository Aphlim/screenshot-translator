import type { TranslateConfig } from '../config/store';
import { createOpenAICompatibleProvider } from './openaiCompatible';

export interface TranslationProvider {
  /** Translate English text → Chinese, preserving paragraph / line breaks. */
  translate(text: string): Promise<string>;
}

/**
 * Provider factory. Today we have one implementation (OpenAI-compatible HTTP),
 * which covers DeepSeek, OpenAI, SiliconFlow, Moonshot, Zhipu, etc. Future
 * providers (Anthropic, local llama.cpp) would branch here.
 *
 * `systemPrompt` is supplied by the caller — the orchestrator looks up the
 * user-selected preset from PROMPT_PRESETS in shared/channels.
 */
export function buildProvider(
  config: TranslateConfig,
  systemPrompt: string,
): TranslationProvider {
  return createOpenAICompatibleProvider(config, systemPrompt);
}
