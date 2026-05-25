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
  SettingsGet: 'settings:get',                // → returns current AppConfig
  SettingsSave: 'settings:save',              // ← receives full AppConfig, persists
  SettingsTestConnection: 'settings:test',    // ← receives TranslateConfig, returns TestResult
  SettingsOpenConfigFolder: 'settings:open-folder',
  SettingsClose: 'settings:close',
} as const;

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel];

export const DEFAULT_HOTKEY = 'CommandOrControl+Alt+T';

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
  /** ID of the active prompt preset (see PROMPT_PRESETS). */
  promptPresetId?: string;
  hotkey?: string;
  ocrEngine?: 'paddle' | 'tesseract';
}

// --- Prompt presets (system-prompt templates the user can pick from) ---

export interface PromptPreset {
  id: string;
  label: string;
  description: string;
  systemPrompt: string;
}

export const DEFAULT_PROMPT_PRESET_ID = 'general';

export const PROMPT_PRESETS: PromptPreset[] = [
  {
    id: 'general',
    label: '通用',
    description: '日常网页、文档、UI、邮件、新闻 —— 大多数情况都用这个',
    systemPrompt: `你是一个保守的翻译。用户给你的英文是 OCR 从截图识别出来的,可能夹杂噪声。

严格规则:
1. 只输出译文,不要前言、解释、注释、Markdown、引号。
2. 译为简体中文。保留原文段落结构和换行。
3. 噪声(如 \`Ai!1\`、\`NK fR\`、孤立单字符、随机符号串)直接跳过,不要翻译,不要编造人名 / 缩写来"解释"它。
4. 不要主动猜测或修正看起来奇怪的字母组合。只翻译能识别为常见英文单词的内容。
5. 代码、命令、文件路径、URL、变量名、专有名词、人名、品牌名、版本号保持原样不译。
6. 输入实际上不是英文(已是中文 / 日文 / 韩文等),原样返回不翻译。
7. 整段输入都是噪声、没有任何可理解的英文 → 只输出: (无可翻译内容)`,
  },
  {
    id: 'academic',
    label: '学术',
    description: '论文、技术规范、研究报告 —— 用词正式,保留术语原文',
    systemPrompt: `你是学术翻译专家。把英文学术内容翻译为简体中文,严格遵守:

1. 只输出译文,不要前言、解释、注释、Markdown。
2. 保留原文段落结构和换行。
3. **学术术语在首次出现时,保留英文原文,中文译名用括号注释**。例如 "deep learning (深度学习)"、"transformer (变换器架构)"。后续出现的同一术语可只用中文。
4. 人名、机构名、引用编号(如 [12])、数学符号、单位、公式保持原样不译。
5. 译文使用正式严谨的中文学术表达,长句允许保留(不强行短句化)。
6. 噪声(乱字母、随机符号)直接跳过,不要硬翻。
7. 输入非英文时原样返回。`,
  },
  {
    id: 'code',
    label: '代码',
    description: '代码注释、API 文档、错误信息、CLI 输出',
    systemPrompt: `你是面向程序员的翻译。把英文翻译为简体中文,严格遵守:

1. 只输出译文,不要任何额外内容。
2. 保留原文段落和换行结构。
3. **代码片段、命令、函数名、变量名、类名、文件路径、URL、错误码、版本号、配置项、HTTP method、HTTP 状态码全部保留原文不译**。
4. 编程术语使用程序员熟悉的中文译法:"function"→"函数"、"argument"→"参数"、"return"→"返回"、"thread"→"线程"、"deprecated"→"已弃用",而不是字面意义的中文。
5. 译文风格简洁直白,避免书面化、形容词堆砌。
6. 错误信息保持精准:If "X not found" → "未找到 X"(保留 X 原文)。
7. 噪声直接跳过。`,
  },
  {
    id: 'casual',
    label: '口语',
    description: '聊天、社交媒体、字幕、视频对话',
    systemPrompt: `你是对话翻译。把英文翻译为口语化的简体中文,严格遵守:

1. 只输出译文,不要解释。
2. 保留原文段落。
3. 用自然的中文口语表达,**避免书面化、生硬的直译**。可以用"咱""嘛""啊"等语气词。
4. 英语俚语、网络梗:有对应的中文等价就用(如 "fr fr" → "真的真的"、"GOAT" → "史上最强")。
5. 缩写(LOL / OMG / WTF / IMO 等)用中文等价或保留并简短说明。
6. 人名、品牌名、@用户名、#话题标签保持原样。
7. 噪声直接跳过。`,
  },
];


export interface SettingsTestResult {
  ok: boolean;
  /** Round-trip time in ms when ok=true */
  ms?: number;
  /** Friendly error message when ok=false */
  message?: string;
  /** HTTP status if it was an API error */
  status?: number;
}
