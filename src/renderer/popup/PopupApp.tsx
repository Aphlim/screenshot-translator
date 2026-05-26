import { useEffect, useState } from 'react';
import type { PopupState } from '@shared/channels';
import type { PopupApi } from '../../preload/popup';

declare global {
  interface Window {
    popupApi: PopupApi;
  }
}

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
      // ignore
    }
  };

  const isRecognizing = state.status === 'recognizing';
  const isTranslating = state.status === 'translating';
  const isDone = state.status === 'done';
  const isError = state.status === 'error';

  return (
    <div className="shell">
      <div className="header">
        <div className="brand">
          <span className="brand-dot" />
          <span className="brand-title">框译</span>
          <span className="brand-subtitle">· 译文</span>
        </div>
        <div className="header-actions">
          {isDone && (
            <button
              className={`action-btn btn-orange ${copied ? 'copied' : ''}`}
              onClick={onCopy}
              type="button"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
          <button
            className="action-btn"
            onClick={() => window.popupApi.close()}
            type="button"
          >
            Esc
          </button>
        </div>
      </div>

      <div className="translation-container">
        {isRecognizing ? (
          <div className="full-state">
            <span className="loading-row">
              <span className="pulse-loading-dot"><span /><span /><span /></span>
              正在识别图中文本…
            </span>
          </div>
        ) : isError && !state.original ? (
          <div className="full-state">
            <span className="text error">{state.message ?? '未知错误'}</span>
          </div>
        ) : (
          <div className="translation-pane">
            {/* Left column: original (OCR output) */}
            <section className="column left">
              <span className="crosshair lt">+</span>
              <span className="crosshair rb">+</span>
              <div className="column-header">
                <span className="column-tag">Original</span>
                <span className="column-indicator">EN</span>
              </div>
              <div className="column-body">
                <p className="text original">{state.original ?? ''}</p>
              </div>
            </section>

            {/* Right column: translation */}
            <section className="column right">
              <span className="crosshair lt">+</span>
              <span className="crosshair rb">+</span>
              <div className="column-header">
                <span className="column-tag">Translation</span>
                <span className="column-indicator accent">ZH</span>
              </div>
              <div className="column-body">
                {isTranslating && (
                  <div className="loading-row">
                    <span className="pulse-loading-dot"><span /><span /><span /></span>
                    翻译中…
                  </div>
                )}
                {isDone && <p className="text translated">{state.translated ?? ''}</p>}
                {isError && <p className="text error">{state.message ?? '未知错误'}</p>}
              </div>
            </section>
          </div>
        )}

        <StatusBar state={state} />
      </div>
    </div>
  );
}

/** Bottom mono-font status strip — shows model name + current pipeline state. */
function StatusBar({ state }: { state: PopupState }) {
  const modelLabel = (state.model ?? '').toUpperCase() || '—';

  let statusNode: React.ReactNode;
  switch (state.status) {
    case 'recognizing':
      statusNode = <span className="status-running">OCR…</span>;
      break;
    case 'translating':
      statusNode = <span className="status-running">TRANSLATING…</span>;
      break;
    case 'done':
      statusNode = (
        <>
          <span className="status-ok">DONE</span>
          {state.translateMs != null && <span>{state.translateMs}ms</span>}
        </>
      );
      break;
    case 'error':
      statusNode = <span className="status-fail">FAILED</span>;
      break;
  }

  return (
    <div className="status-bar">
      <span>{modelLabel}</span>
      <span className="meta">{statusNode}</span>
    </div>
  );
}
