import { useEffect, useState } from 'react';
import type { PopupState } from '@shared/channels';
import type { PopupApi } from '../../preload/popup';

declare global {
  interface Window {
    popupApi: PopupApi;
  }
}

const STATUS_LABEL: Record<PopupState['status'], string> = {
  recognizing: '识别中',
  translating: '翻译中',
  done: '完成',
  error: '错误',
};

export default function PopupApp() {
  const [state, setState] = useState<PopupState>({ status: 'recognizing' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.popupApi.ready().then((s) => {
      if (s) setState(s);
    });
    return window.popupApi.onUpdate(setState);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') window.popupApi.close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onCopy = async (): Promise<void> => {
    if (!state.translated) return;
    try {
      await navigator.clipboard.writeText(state.translated);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard write may fail in restricted contexts; ignore.
    }
  };

  const isRecognizingOnly = state.status === 'recognizing';
  const isError = state.status === 'error';
  const hasTranslation = state.status === 'done' && Boolean(state.translated);

  return (
    <div className="shell">
      <div className="header">
        <div className="brand">
          <span className="brand-dot" />
          <span>FuckEnglish</span>
          <span className="status">· {STATUS_LABEL[state.status]}</span>
        </div>
        <div className="actions">
          {hasTranslation && (
            <button className={`btn primary ${copied ? 'toast-copied' : ''}`} onClick={onCopy}>
              {copied ? '已复制' : '复制译文'}
            </button>
          )}
          <button className="btn" onClick={() => window.popupApi.close()}>关闭</button>
        </div>
      </div>

      {isRecognizingOnly ? (
        <div className="full-state">
          <div className="loading">
            <span className="dot" /><span className="dot" /><span className="dot" />
            <span>正在识别图中文本…</span>
          </div>
        </div>
      ) : isError && !state.original ? (
        <div className="full-state">
          <span className="text error">{state.message ?? '未知错误'}</span>
        </div>
      ) : (
        <div className="body">
          <section className="column">
            <div className="column-head">
              <span>Original</span>
            </div>
            <div className="column-body">
              <p className="text original">{state.original ?? ''}</p>
            </div>
          </section>

          <section className="column">
            <div className="column-head">
              <span>中文译文</span>
            </div>
            <div className="column-body">
              {state.status === 'translating' && (
                <div className="loading">
                  <span className="dot" /><span className="dot" /><span className="dot" />
                  <span>翻译中…</span>
                </div>
              )}
              {state.status === 'done' && (
                <p className="text translated">{state.translated ?? ''}</p>
              )}
              {state.status === 'error' && (
                <p className="text error">{state.message ?? '未知错误'}</p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
