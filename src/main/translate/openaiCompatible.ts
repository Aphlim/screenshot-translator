import OpenAI from 'openai';
import type { TranslateConfig } from '../config/store';
import type { TranslationProvider } from './index';

/**
 * Build an OpenAI-compatible HTTP client translator. The system prompt is
 * injected by the caller (orchestrator), letting the user swap "translation
 * style" via the prompt preset selector in settings without changing code.
 */
export function createOpenAICompatibleProvider(
  config: TranslateConfig,
  systemPrompt: string,
): TranslationProvider {
  const client = new OpenAI({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  });

  return {
    async translate(text: string): Promise<string> {
      const res = await client.chat.completions.create({
        model: config.model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
      });
      const content = res.choices[0]?.message?.content;
      if (typeof content !== 'string' || content.length === 0) {
        throw new Error('Provider returned empty translation');
      }
      return content.trim();
    },
  };
}
