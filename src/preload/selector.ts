import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannel, type SelectionRect, type SelectorPayload } from '@shared/channels';

export interface SelectorApi {
  ready: () => Promise<SelectorPayload | null>;
  confirm: (rect: SelectionRect) => void;
  cancel: () => void;
}

const api: SelectorApi = {
  ready: () => ipcRenderer.invoke(IpcChannel.SelectorReady),
  confirm: (rect) => ipcRenderer.send(IpcChannel.SelectorConfirm, rect),
  cancel: () => ipcRenderer.send(IpcChannel.SelectorCancel),
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('selectorApi', api);
  } catch (err) {
    console.error(err);
  }
} else {
  (window as unknown as { selectorApi: SelectorApi }).selectorApi = api;
}
