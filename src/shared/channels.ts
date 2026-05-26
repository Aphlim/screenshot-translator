export const IpcChannel = {
  Ping: 'app:ping',
  HotkeyFired: 'hotkey:fired',

  // Selector window
  SelectorReady: 'selector:ready',
  SelectorScreenshot: 'selector:screenshot',
  SelectorConfirm: 'selector:confirm',
  SelectorCancel: 'selector:cancel',

  // Popup window (translation result)
  PopupReady: 'popup:ready',
  PopupUpdate: 'popup:update',
  PopupClose: 'popup:close',

  // Settings window
  SettingsGet: 'settings:get',
  SettingsSave: 'settings:save',
  SettingsTestConnection: 'settings:test',
  SettingsOpenConfigFolder: 'settings:open-folder',
  SettingsClose: 'settings:close',
  SettingsCheckHotkey: 'settings:check-hotkey',   // dry-run register a hotkey to see if free

  // History window
  HistoryGet: 'history:get',
  HistoryDeleteOne: 'history:delete-one',
  HistoryClear: 'history:clear',
  HistoryCopy: 'history:copy',
  HistoryClose: 'history:close',
} as const;

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel];

/** Single-handed Ctrl+letter; J chosen for low conflict + easy reach. */
export const DEFAULT_HOTKEY = 'CommandOrControl+J';

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectorPayload {
  imageDataUrl: string;
  width: number;
  height: number;
  scaleFactor: number;
}

export type PopupStatus = 'recognizing' | 'translating' | 'done' | 'error';

export interface PopupState {
  status: PopupStatus;
  original?: string;
  translated?: string;
  message?: string;
  /** Model ID used for translation — shown in the popup's bottom status bar. */
  model?: string;
  /** Translation round-trip time in ms, shown when status === 'done'. */
  translateMs?: number;
}

// --- Settings ---

export interface SettingsTranslate {
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface SettingsPayload {
  translate?: SettingsTranslate;
  /** ID of the active prompt preset (PROMPT_PRESETS or CUSTOM_PROMPT_PRESET_ID). */
  promptPresetId?: string;
  /** User-defined system prompt template; used when promptPresetId === 'custom'. */
  customPrompt?: string;
  /** Electron accelerator string, e.g. "CommandOrControl+J". */
  hotkey?: string;
  /** ID into SOURCE_LANGUAGES — picks which OCR engine + language pack to use. */
  sourceLanguage?: string;
  /** ID into TARGET_LANGUAGES — substitutes into prompt as the target language. */
  targetLanguage?: string;
}

export interface SettingsTestResult {
  ok: boolean;
  /** Round-trip time in ms when ok=true */
  ms?: number;
  /** Friendly error message when ok=false */
  message?: string;
  /** HTTP status if it was an API error */
  status?: number;
}

/** Result of attempting to (re-)register a hotkey. */
export interface HotkeyRegisterResult {
  ok: boolean;
  /** When ok=false: human-readable reason (e.g. "already taken by another app") */
  message?: string;
}

// --- Source languages (drives OCR engine choice) ---

export interface SourceLanguage {
  id: string;
  label: string;
  /** Which OCR engine handles this language. */
  engine: 'paddle' | 'tesseract';
  /** Tesseract language pack codes (e.g. ['jpn']) — only used when engine === 'tesseract'. */
  tesseractLangs?: string[];
  /** Approximate language-pack download size shown in the UI as a hint. */
  sizeHint?: string;
}

export const SOURCE_LANGUAGES: SourceLanguage[] = [
  { id: 'auto', label: '自动 (英文 + 中文)', engine: 'paddle' },
  { id: 'en', label: 'English', engine: 'paddle' },
  { id: 'zh', label: '中文 / Chinese', engine: 'paddle' },
  { id: 'ja', label: '日本語 / Japanese', engine: 'tesseract', tesseractLangs: ['jpn'], sizeHint: '~12MB' },
  { id: 'ko', label: '한국어 / Korean', engine: 'tesseract', tesseractLangs: ['kor'], sizeHint: '~9MB' },
];

export const DEFAULT_SOURCE_LANGUAGE = 'auto';

// --- Target languages (substituted into prompt as the translation target) ---

export interface TargetLanguage {
  id: string;
  label: string;
  /** Name used in the LLM prompt (e.g. "简体中文", "English"). */
  promptName: string;
}

export const TARGET_LANGUAGES: TargetLanguage[] = [
  { id: 'zh-CN', label: '简体中文', promptName: '简体中文' },
  { id: 'zh-TW', label: '繁體中文', promptName: '繁體中文' },
  { id: 'en', label: 'English', promptName: 'natural English' },
  { id: 'ja', label: '日本語 / Japanese', promptName: '日本語 (Japanese)' },
  { id: 'ko', label: '한국어 / Korean', promptName: '한국어 (Korean)' },
];

export const DEFAULT_TARGET_LANGUAGE = 'zh-CN';

// --- Prompt presets ---

export interface PromptPreset {
  id: string;
  label: string;
  description: string;
  /**
   * Template string. The orchestrator substitutes `{target}` with the user's
   * chosen target-language `promptName` before sending to the LLM. This lets
   * presets be reused across all target languages without duplicating prompts.
   */
  systemPrompt: string;
}

export const DEFAULT_PROMPT_PRESET_ID = 'general';

/**
 * Sentinel ID for the user-defined custom prompt. When the active preset is
 * this value, the orchestrator reads `customPrompt` from config instead of
 * looking up PROMPT_PRESETS. Kept separate so the preset list stays static
 * and customizable independently.
 */
export const CUSTOM_PROMPT_PRESET_ID = 'custom';

export const PROMPT_PRESETS: PromptPreset[] = [
  {
    id: 'general',
    label: '通用',
    description: '日常网页、文档、UI、邮件、新闻 —— 大多数情况都用这个',
    systemPrompt: `你是一个保守的翻译。用户给你的文本是 OCR 从截图识别出来的,可能夹杂噪声。

严格规则:
1. 只输出译文,不要前言、解释、注释、Markdown、引号。
2. 译为 {target}。保留原文段落结构和换行。
3. 噪声(如 \`Ai!1\`、\`NK fR\`、孤立单字符、随机符号串)直接跳过,不要翻译,不要编造人名 / 缩写来"解释"它。
4. 不要主动猜测或修正看起来奇怪的字母组合。只翻译能识别为真实单词的内容。
5. 代码、命令、文件路径、URL、变量名、专有名词、人名、品牌名、版本号保持原样不译。
6. 输入实际上已经是 {target},原样返回不翻译。
7. 整段输入都是噪声、没有任何可理解的内容 → 只输出: (无可翻译内容)`,
  },
  {
    id: 'academic',
    label: '学术',
    description: '论文、技术规范、研究报告 —— 用词正式,保留术语原文',
    systemPrompt: `你是学术翻译专家。把输入翻译为 {target},严格遵守:

1. 只输出译文,不要前言、解释、注释、Markdown。
2. 保留原文段落结构和换行。
3. 学术术语在首次出现时,保留原文,目标语译名用括号注释。
4. 人名、机构名、引用编号(如 [12])、数学符号、单位、公式保持原样不译。
5. 译文使用正式严谨的学术表达。
6. 噪声(乱字母、随机符号)直接跳过,不要硬翻。
7. 输入已经是 {target} 时原样返回。`,
  },
  {
    id: 'code',
    label: '代码',
    description: '代码注释、API 文档、错误信息、CLI 输出',
    systemPrompt: `你是面向程序员的翻译。把输入翻译为 {target},严格遵守:

1. 只输出译文,不要任何额外内容。
2. 保留原文段落和换行结构。
3. 代码片段、命令、函数名、变量名、类名、文件路径、URL、错误码、版本号、配置项、HTTP method、HTTP 状态码全部保留原文不译。
4. 编程术语使用程序员熟悉的译法(英→中如 "function"→"函数"、"argument"→"参数"、"return"→"返回")。
5. 译文风格简洁直白,避免书面化、形容词堆砌。
6. 错误信息保持精准:If "X not found" → 翻为"未找到 X"(保留 X 原文)。
7. 噪声直接跳过。`,
  },
  {
    id: 'casual',
    label: '口语',
    description: '聊天、社交媒体、字幕、视频对话',
    systemPrompt: `你是对话翻译。把输入翻译为口语化的 {target},严格遵守:

1. 只输出译文,不要解释。
2. 保留原文段落。
3. 用自然的口语表达,避免书面化、生硬的直译。
4. 俚语、网络梗:有对应的目标语等价就用,没有就保留原文加简短解释。
5. 缩写(LOL / OMG / WTF / IMO 等)用目标语等价表达。
6. 人名、品牌名、@用户名、#话题标签保持原样。
7. 噪声直接跳过。`,
  },
];

// --- Translation history ---

export interface HistoryEntry {
  id: string;
  /** Unix milliseconds. */
  timestamp: number;
  original: string;
  translated: string;
  sourceLanguage: string;
  targetLanguage: string;
  presetId: string;
  model: string;
  /** Round-trip OCR + translate time, ms (optional, may be missing on old entries). */
  totalMs?: number;
}

/** Soft cap — orchestrator prunes oldest entries past this. */
export const HISTORY_MAX = 100;
