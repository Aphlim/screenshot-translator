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
 */
export function buildProvider(config: TranslateConfig): TranslationProvider {
  return createOpenAICompatibleProvider(config);
}
