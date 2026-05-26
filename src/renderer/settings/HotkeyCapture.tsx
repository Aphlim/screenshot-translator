import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;          // Electron accelerator e.g. "CommandOrControl+J"
  onChange: (next: string) => void;
}

/**
 * A click-to-record hotkey input. Click "录制",then press any modifier +
 * letter / digit / function key. We build an Electron accelerator string,
 * dry-run register it via IPC, and show whether it's free.
 */
export default function HotkeyCapture({ value, onChange }: Props) {
  const [recording, setRecording] = useState(false);
  const [checkResult, setCheckResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const recordingRef = useRef(recording);
  recordingRef.current = recording;

  const cancelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Block global keys while recording so they don't propagate to other apps.
  useEffect(() => {
    if (!recording) return;

    const onKeyDown = (e: KeyboardEvent): void => {
      if (!recordingRef.current) return;
      // Esc cancels recording without changing the value.
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setRecording(false);
        return;
      }
      const accelerator = buildAccelerator(e);
      if (!accelerator) return;
      // Need at least one modifier (otherwise we'd hijack every keystroke).
      const hasModifier = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey;
      if (!hasModifier) return;

      e.preventDefault();
      e.stopPropagation();

      onChange(accelerator);
      setRecording(false);
      // Dry-run register through IPC to check if it conflicts.
      window.settingsApi.checkHotkey(accelerator).then(setCheckResult);
    };

    // Use capture so we see the key before any other handler.
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [recording, onChange]);

  // Auto-cancel recording if the user wanders off for 5s.
  useEffect(() => {
    if (cancelTimer.current) clearTimeout(cancelTimer.current);
    if (recording) {
      cancelTimer.current = setTimeout(() => setRecording(false), 5000);
    }
    return () => {
      if (cancelTimer.current) clearTimeout(cancelTimer.current);
    };
  }, [recording]);

  // Re-check current value when it changes externally (e.g. on load).
  useEffect(() => {
    if (!value || recording) return;
    window.settingsApi.checkHotkey(value).then(setCheckResult);
  }, [value, recording]);

  const handleStart = (): void => {
    setCheckResult(null);
    setRecording(true);
  };

  const humanLabel = formatAccelerator(value);

  return (
    <div className="hotkey-capture">
      <div
        className={`hotkey-display ${recording ? 'recording' : ''} ${
          checkResult && !checkResult.ok ? 'invalid' : ''
        }`}
      >
        {recording ? '请按下组合键…(Esc 取消)' : humanLabel || '未设置'}
      </div>
      <button
        className="btn btn-secondary hotkey-btn"
        type="button"
        onClick={handleStart}
        disabled={recording}
      >
        {recording ? '录制中' : '录制'}
      </button>
      {checkResult && !checkResult.ok && !recording && (
        <div className="hotkey-warning">⚠ {checkResult.message}</div>
      )}
    </div>
  );
}

function buildAccelerator(e: KeyboardEvent): string | null {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  const key = normalizeKey(e);
  if (!key) return null;
  parts.push(key);
  return parts.join('+');
}

function normalizeKey(e: KeyboardEvent): string | null {
  // Ignore lone modifier press
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null;

  if (/^[a-zA-Z]$/.test(e.key)) return e.key.toUpperCase();
  if (/^[0-9]$/.test(e.key)) return e.key;
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(e.key)) return e.key;
  if (e.key === ' ') return 'Space';
  if (e.key === 'Enter') return 'Return';
  if (e.key === 'Tab') return 'Tab';
  if (e.key === 'Backspace') return 'Backspace';
  if (e.key === 'Delete') return 'Delete';
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    return e.key.replace('Arrow', '');
  }
  return null;
}

function formatAccelerator(acc: string): string {
  if (!acc) return '';
  return acc
    .split('+')
    .map((p) => {
      if (p === 'CommandOrControl' || p === 'CmdOrCtrl') return 'Ctrl';
      if (p === 'Control') return 'Ctrl';
      if (p === 'Command' || p === 'Cmd' || p === 'Meta' || p === 'Super') return 'Cmd';
      return p;
    })
    .join(' + ');
}
