import { useEffect, useRef, useState } from 'react';
import {
  PROMPT_PRESETS,
  DEFAULT_PROMPT_PRESET_ID,
  CUSTOM_PROMPT_PRESET_ID,
  SOURCE_LANGUAGES,
  DEFAULT_SOURCE_LANGUAGE,
  TARGET_LANGUAGES,
  DEFAULT_TARGET_LANGUAGE,
  DEFAULT_HOTKEY,
  type SettingsPayload,
  type SettingsTestResult,
} from '@shared/channels';
import type { SettingsApi } from '../../preload/settings';
import HotkeyCapture from './HotkeyCapture';

declare global {
  interface Window {
    settingsApi: SettingsApi;
  }
}

interface PresetBaseUrl {
  label: string;
  url: string;
  exampleModel: string;
}

const PRESETS: PresetBaseUrl[] = [
  { label: 'DeepSeek', url: 'https://api.deepseek.com', exampleModel: 'deepseek-chat' },
  { label: 'OpenAI', url: 'https://api.openai.com/v1', exampleModel: 'gpt-4o-mini' },
  { label: 'SiliconFlow', url: 'https://api.siliconflow.cn/v1', exampleModel: 'Qwen/Qwen2.5-7B-Instruct' },
  { label: 'Moonshot', url: 'https://api.moonshot.cn/v1', exampleModel: 'moonshot-v1-8k' },
];

type Banner =
  | { kind: 'welcome'; text: React.ReactNode }
  | { kind: 'success'; text: React.ReactNode }
  | { kind: 'error'; text: React.ReactNode }
  | { kind: 'info'; text: React.ReactNode }
  | null;

export default function SettingsApp() {
  const [baseURL, setBaseURL] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [promptPresetId, setPromptPresetId] = useState<string>(DEFAULT_PROMPT_PRESET_ID);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [sourceLanguage, setSourceLanguage] = useState<string>(DEFAULT_SOURCE_LANGUAGE);
  const [targetLanguage, setTargetLanguage] = useState<string>(DEFAULT_TARGET_LANGUAGE);
  const [hotkey, setHotkey] = useState<string>(DEFAULT_HOTKEY);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyError, setKeyError] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [bannerFading, setBannerFading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    window.settingsApi.get().then((cfg: SettingsPayload) => {
      setBaseURL(cfg.translate?.baseURL ?? '');
      setApiKey(cfg.translate?.apiKey ?? '');
      setModel(cfg.translate?.model ?? '');
      setPromptPresetId(cfg.promptPresetId ?? DEFAULT_PROMPT_PRESET_ID);
      setCustomPrompt(cfg.customPrompt ?? '');
      setSourceLanguage(cfg.sourceLanguage ?? DEFAULT_SOURCE_LANGUAGE);
      setTargetLanguage(cfg.targetLanguage ?? DEFAULT_TARGET_LANGUAGE);
      setHotkey(cfg.hotkey ?? DEFAULT_HOTKEY);
      setLoaded(true);

      if (!cfg.translate?.apiKey) {
        setBanner({
          kind: 'welcome',
          text: (
            <span>
              欢迎使用 <strong>FuckEnglish</strong>。在下方填入你的 API 配置即可开始。
              推荐使用 <strong>DeepSeek</strong>(中国大陆访问快、成本低)。
            </span>
          ),
        });
      }
    });
  }, []);

  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!banner || banner.kind === 'welcome') return;
    setBannerFading(false);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    fadeTimer.current = setTimeout(() => setBannerFading(true), 3000);
    dismissTimer.current = setTimeout(() => setBanner(null), 3500);
    return () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [banner]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') window.settingsApi.close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const formValid = baseURL.trim() && apiKey.trim() && model.trim();
  const selectedPreset = PRESETS.find((p) => p.url === baseURL.trim());

  const applyPreset = (p: PresetBaseUrl): void => {
    setBaseURL(p.url);
    if (!model.trim()) setModel(p.exampleModel);
  };

  const onTest = async (): Promise<void> => {
    if (!formValid || testing) return;
    setTesting(true);
    setKeyError(false);
    setBanner(null);
    try {
      const res: SettingsTestResult = await window.settingsApi.testConnection({
        baseURL: baseURL.trim(),
        apiKey: apiKey.trim(),
        model: model.trim(),
      });
      if (res.ok) {
        setBanner({
          kind: 'success',
          text: (
            <span>
              ✓ 连接成功,响应耗时 <strong>{res.ms}ms</strong>
            </span>
          ),
        });
      } else {
        if (res.status === 401 || res.status === 403) setKeyError(true);
        const statusPrefix = res.status ? `${res.status} ` : '';
        setBanner({
          kind: 'error',
          text: (
            <span>
              ✗ <strong>{statusPrefix}</strong>
              {res.message ?? '连接失败'}
            </span>
          ),
        });
      }
    } finally {
      setTesting(false);
    }
  };

  const onSave = async (closeAfter: boolean): Promise<void> => {
    if (!formValid || saving) return;
    setSaving(true);
    try {
      const res = await window.settingsApi.save({
        translate: { baseURL: baseURL.trim(), apiKey: apiKey.trim(), model: model.trim() },
        promptPresetId,
        customPrompt,
        sourceLanguage,
        targetLanguage,
        hotkey,
      });

      // Hotkey-specific feedback overrides the generic save banner.
      if (res.hotkey && !res.hotkey.ok) {
        setBanner({
          kind: 'error',
          text: <span>✗ {res.hotkey.message ?? '快捷键注册失败'}</span>,
        });
        return;
      }

      setBanner({ kind: 'info', text: <span>✓ 已保存,下一次按快捷键即生效</span> });
      if (closeAfter) {
        setTimeout(() => window.settingsApi.close(), 400);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="shell">
      <div className="header">
        <div className="brand">
          <span className="brand-dot" />
          <span className="brand-title">FuckEnglish</span>
          <span className="brand-subtitle">· 设置</span>
        </div>
        <div className="header-actions">
          <button className="close-btn" onClick={() => window.settingsApi.close()} title="关闭">
            ✕
          </button>
        </div>
      </div>

      {/* Floating transient banner — overlays the top of the body, doesn't
          disturb form layout. Welcome banner stays inline below (it's
          persistent until the user fills in the API key). */}
      {banner && banner.kind !== 'welcome' && (
        <div className={`banner banner-floating ${banner.kind} ${bannerFading ? 'fade-out' : ''}`}>
          <div>{banner.text}</div>
        </div>
      )}

      <div className="body">
        {banner && banner.kind === 'welcome' && (
          <div className="banner banner-inline-top welcome">
            <div>{banner.text}</div>
          </div>
        )}

        <section className="section">
          <h3 className="section-title">翻译 API 配置</h3>

          <div className="form-group">
            <div className="label-row">
              <label className="form-label" htmlFor="baseURL">接口地址</label>
              <span className="form-helper">OpenAI 兼容服务的根 URL</span>
            </div>
            <div className="input-container">
              <input
                id="baseURL"
                className="form-input"
                type="text"
                value={baseURL}
                placeholder="https://api.deepseek.com"
                onChange={(e) => setBaseURL(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="chips-group">
              {PRESETS.map((p) => (
                <button
                  key={p.url}
                  className={`chip ${selectedPreset?.url === p.url ? 'chip-selected' : ''}`}
                  onClick={() => applyPreset(p)}
                  type="button"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <div className="label-row">
              <label className="form-label" htmlFor="apiKey">API Key</label>
              <span className={`form-helper ${keyError ? 'error-text' : ''}`}>
                {keyError ? 'API 验证未通过' : '仅保存在本机,不会上传'}
              </span>
            </div>
            <div className="input-container">
              <input
                id="apiKey"
                className={`form-input input-password ${keyError ? 'input-error' : ''}`}
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                placeholder="sk-..."
                onChange={(e) => {
                  setApiKey(e.target.value);
                  if (keyError) setKeyError(false);
                }}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                className="password-toggle-btn"
                onClick={() => setShowKey((v) => !v)}
                title={showKey ? '隐藏' : '显示'}
                type="button"
              >
                {showKey ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <div className="label-row">
              <label className="form-label" htmlFor="model">模型 (Model)</label>
              <span className="form-helper">使用的模型 ID</span>
            </div>
            <div className="input-container">
              <input
                id="model"
                className="form-input"
                type="text"
                value={model}
                placeholder="deepseek-chat"
                onChange={(e) => setModel(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>
        </section>

        <section className="section">
          <h3 className="section-title">语言</h3>

          <div className="form-group">
            <div className="label-row">
              <label className="form-label">源语言(OCR 识别)</label>
              <span className="form-helper">en/zh 用 PaddleOCR;ja/ko 用 Tesseract</span>
            </div>
            <div className="chips-group">
              {SOURCE_LANGUAGES.map((l) => (
                <button
                  key={l.id}
                  className={`chip ${sourceLanguage === l.id ? 'chip-selected' : ''}`}
                  onClick={() => setSourceLanguage(l.id)}
                  type="button"
                  title={l.sizeHint ? `首次使用会下载 ${l.sizeHint} 语言包` : ''}
                >
                  {l.label}
                  {l.sizeHint && <span className="chip-hint"> · {l.sizeHint}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <div className="label-row">
              <label className="form-label">目标语言(翻译为)</label>
              <span className="form-helper">影响 LLM 提示词中的目标语言</span>
            </div>
            <div className="chips-group">
              {TARGET_LANGUAGES.map((l) => (
                <button
                  key={l.id}
                  className={`chip ${targetLanguage === l.id ? 'chip-selected' : ''}`}
                  onClick={() => setTargetLanguage(l.id)}
                  type="button"
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <h3 className="section-title">翻译风格</h3>
          <div className="form-group">
            <div className="label-row">
              <label className="form-label">提示词预设</label>
              <span className="form-helper">影响 LLM 翻译时的语气和术语处理</span>
            </div>
            <div className="chips-group">
              {PROMPT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  className={`chip ${promptPresetId === p.id ? 'chip-selected' : ''}`}
                  onClick={() => setPromptPresetId(p.id)}
                  type="button"
                >
                  {p.label}
                </button>
              ))}
              <button
                className={`chip ${promptPresetId === CUSTOM_PROMPT_PRESET_ID ? 'chip-selected' : ''}`}
                onClick={() => {
                  // First time switching to custom: prefill with the currently
                  // selected preset so the user has a starting point to edit.
                  if (!customPrompt.trim()) {
                    const current = PROMPT_PRESETS.find((p) => p.id === promptPresetId);
                    setCustomPrompt(current?.systemPrompt ?? PROMPT_PRESETS[0].systemPrompt);
                  }
                  setPromptPresetId(CUSTOM_PROMPT_PRESET_ID);
                }}
                type="button"
              >
                自定义
              </button>
            </div>
            {promptPresetId === CUSTOM_PROMPT_PRESET_ID ? (
              <>
                <textarea
                  className="prompt-textarea"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="编写你自己的 system prompt。使用 {target} 占位符代表用户选择的目标语言(会自动替换)。"
                  rows={9}
                  spellCheck={false}
                />
                <div className="prompt-hint">
                  💡 提示:用 <code>{'{target}'}</code> 代表目标语言(会被替换为如"简体中文"、"English"等);
                  写明"只输出译文,不要解释"以避免 LLM 加前言;留空会回退到"通用"预设。
                </div>
              </>
            ) : (
              <div className="preset-description">
                {PROMPT_PRESETS.find((p) => p.id === promptPresetId)?.description ?? ''}
              </div>
            )}
          </div>
        </section>

        <section className="section">
          <h3 className="section-title">快捷键</h3>
          <div className="form-group">
            <div className="label-row">
              <label className="form-label">全局快捷键</label>
              <span className="form-helper">按下"录制"后按一次组合键</span>
            </div>
            <HotkeyCapture value={hotkey} onChange={setHotkey} />
          </div>
        </section>

      </div>

      <div className="footer">
        <button
          className="btn-link"
          onClick={() => window.settingsApi.openConfigFolder()}
          type="button"
          title="在资源管理器中打开 %APPDATA%\fuck-english"
        >
          <FolderIcon />
          打开配置文件夹
        </button>
        <div className="footer-actions">
          <button
            className="btn btn-secondary"
            onClick={onTest}
            disabled={!formValid || testing || saving}
            type="button"
          >
            {testing ? (
              <span className="pulse-loading-dot">
                <span /><span /><span />
              </span>
            ) : (
              '测试连接'
            )}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onSave(true)}
            disabled={!formValid || saving || testing}
            type="button"
          >
            {saving && !loaded ? '保存中…' : '保存并关闭'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
      />
    </svg>
  );
}
