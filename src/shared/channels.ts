export const IpcChannel = {
  Ping: 'app:ping',
  HotkeyFired: 'hotkey:fired',

  // Selector window
  SelectorReady: 'selector:ready',
  SelectorScreenshot: 'selector:screenshot',
  SelectorConfirm: 'selector:confirm',
  SelectorCancel: 'selector:cancel',

  // Popup window (translation result)
  PopupReady: 'popup:ready',     // renderer → main, returns current state
  PopupUpdate: 'popup:update',   // main → renderer, push state changes
  PopupClose: 'popup:close',     // renderer → main, user clicked X / pressed Esc
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
  /** Recognized English text (filled once OCR completes). */
  original?: string;
  /** Final translation (filled when status === 'done'). */
  translated?: string;
  /** Human-readable error message when status === 'error'. */
  message?: string;
}
