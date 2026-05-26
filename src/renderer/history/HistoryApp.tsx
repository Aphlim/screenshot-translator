import { useEffect, useMemo, useState } from 'react';
import {
  type HistoryEntry,
  SOURCE_LANGUAGES,
  TARGET_LANGUAGES,
} from '@shared/channels';
import type { HistoryApi } from '../../preload/history';

declare global {
  interface Window {
    historyApi: HistoryApi;
  }
}

const langLabel = (id: string, list: { id: string; label: string }[]): string => {
  return list.find((l) => l.id === id)?.label.split(' ')[0] ?? id.toUpperCase();
};

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function HistoryApp() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = (): void => {
    window.historyApi.get().then((items) => {
      setEntries(items);
      setLoaded(true);
    });
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') window.historyApi.close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.trim().toLowerCase();
    return entries.filter(
      (e) =>
        e.original.toLowerCase().includes(q) ||
        e.translated.toLowerCase().includes(q),
    );
  }, [entries, search]);

  const showToast = (text: string): void => {
    setToast(text);
    setTimeout(() => setToast(null), 1500);
  };

  const handleCopy = (text: string, label: string, e: React.MouseEvent): void => {
    e.stopPropagation();
    window.historyApi.copy(text);
    showToast(`✓ 已复制${label}`);
  };

  const handleDelete = async (id: string, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    await window.historyApi.deleteOne(id);
    refresh();
  };

  const handleClearAll = async (): Promise<void> => {
    if (!confirm('确定要清空全部 ' + entries.length + ' 条翻译历史吗?此操作不可撤销。')) return;
    await window.historyApi.clear();
    refresh();
  };

  return (
    <div className="shell">
      <div className="header">
        <div className="brand">
          <span className="brand-dot" />
          <span className="brand-title">FuckEnglish</span>
          <span className="brand-subtitle">· 翻译历史</span>
        </div>
        <div className="header-actions">
          <button
            className="action-btn danger"
            onClick={handleClearAll}
            disabled={entries.length === 0}
            type="button"
            title="清空全部历史"
          >
            Clear All
          </button>
          <button className="close-btn" onClick={() => window.historyApi.close()} title="关闭">
            ✕
          </button>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="search-input"
          type="text"
          placeholder="搜索原文或译文…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <span className="count-text">
          {filtered.length}{search ? ` / ${entries.length}` : ''}
        </span>
      </div>

      <div className="list">
        {!loaded ? null : entries.length === 0 ? (
          <div className="empty">
            还没有翻译历史。<br />
            按下快捷键截图翻译后,记录会自动出现在这里。
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">没有匹配的记录</div>
        ) : (
          filtered.map((entry) => {
            const isExpanded = expandedId === entry.id;
            return (
              <div
                key={entry.id}
                className={`entry ${isExpanded ? 'expanded' : ''}`}
                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
              >
                <div className="entry-meta">
                  <span className="timestamp">{formatTimestamp(entry.timestamp)}</span>
                  <span className="tag">{langLabel(entry.sourceLanguage, SOURCE_LANGUAGES)}</span>
                  <span className="lang-arrow">→</span>
                  <span className="tag">{langLabel(entry.targetLanguage, TARGET_LANGUAGES)}</span>
                  <span className="tag">{entry.model}</span>
                  {entry.totalMs != null && <span>{entry.totalMs}ms</span>}
                  <div className="entry-row-actions">
                    <button onClick={(e) => handleCopy(entry.original, '原文', e)} title="复制原文">
                      Cp Orig
                    </button>
                    <button onClick={(e) => handleCopy(entry.translated, '译文', e)} title="复制译文">
                      Cp 译
                    </button>
                    <button className="danger" onClick={(e) => handleDelete(entry.id, e)} title="删除">
                      Del
                    </button>
                  </div>
                </div>
                <div className="entry-preview">
                  <div className="col">
                    <div className="col-label">Original</div>
                    <div className="col-text original">{entry.original}</div>
                  </div>
                  <div className="col">
                    <div className="col-label zh">
                      Translation <span className="lang-tag">[{langLabel(entry.targetLanguage, TARGET_LANGUAGES)}]</span>
                    </div>
                    <div className="col-text">{entry.translated}</div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className={`copy-toast ${toast ? 'show' : ''}`}>{toast ?? ''}</div>
    </div>
  );
}
