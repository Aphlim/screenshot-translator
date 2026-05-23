import { useEffect, useRef, useState } from 'react';
import type { SelectionRect, SelectorPayload } from '@shared/channels';
import type { SelectorApi } from '../../preload/selector';

declare global {
  interface Window {
    selectorApi: SelectorApi;
  }
}

interface Point { x: number; y: number; }

const MIN_SIZE = 4;

export default function SelectorApp() {
  const [payload, setPayload] = useState<SelectorPayload | null>(null);
  const [startPt, setStartPt] = useState<Point | null>(null);
  const [endPt, setEndPt] = useState<Point | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    window.selectorApi.ready().then((p) => setPayload(p));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        window.selectorApi.cancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onMouseDown = (e: React.MouseEvent): void => {
    if (e.button !== 0) {
      // Right-click cancels.
      window.selectorApi.cancel();
      return;
    }
    draggingRef.current = true;
    const pt = { x: e.clientX, y: e.clientY };
    setStartPt(pt);
    setEndPt(pt);
  };

  const onMouseMove = (e: React.MouseEvent): void => {
    if (!draggingRef.current) return;
    setEndPt({ x: e.clientX, y: e.clientY });
  };

  const onMouseUp = (): void => {
    if (!draggingRef.current || !startPt || !endPt) return;
    draggingRef.current = false;

    const rect = normalizeRect(startPt, endPt);
    if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) {
      // Too small — treat as a misclick; reset and let user try again.
      setStartPt(null);
      setEndPt(null);
      return;
    }
    window.selectorApi.confirm(rect);
  };

  const rect = startPt && endPt ? normalizeRect(startPt, endPt) : null;

  return (
    <div
      className="root"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {payload && <img className="bg" src={payload.imageDataUrl} alt="" />}

      {/* Dim overlay split into 4 strips around the selection. When no
          selection yet, one full-screen dim covers everything. */}
      {rect ? (
        <>
          <div className="dim" style={{ left: 0, top: 0, width: '100%', height: rect.y }} />
          <div className="dim" style={{ left: 0, top: rect.y, width: rect.x, height: rect.height }} />
          <div className="dim" style={{ left: rect.x + rect.width, top: rect.y, right: 0, height: rect.height }} />
          <div className="dim" style={{ left: 0, top: rect.y + rect.height, width: '100%', bottom: 0 }} />
          <div className="rect-border" style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }} />
          <div
            className="size-label"
            style={{
              left: Math.min(rect.x, window.innerWidth - 80),
              top: rect.y >= 22 ? rect.y - 22 : rect.y + rect.height + 6,
            }}
          >
            {Math.round(rect.width)} × {Math.round(rect.height)}
          </div>
        </>
      ) : (
        <div className="dim" style={{ inset: 0 }} />
      )}

      {!rect && <div className="hint">拖动框选要翻译的区域 · Esc / 右键取消</div>}
    </div>
  );
}

function normalizeRect(a: Point, b: Point): SelectionRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}
