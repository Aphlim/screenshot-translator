import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IpcChannel, type PopupState } from '@shared/channels';

export interface PopupApi {
  ready: () => Promise<PopupState | null>;
  onUpdate: (cb: (state: PopupState) => void) => () => void;
  close: () => void;
}

const api: PopupApi = {
  ready: () => ipcRenderer.invoke(IpcChannel.PopupReady),
  onUpdate: (cb) => {
    const listener = (_e: IpcRendererEvent, state: PopupState): void => cb(state);
    ipcRenderer.on(IpcChannel.PopupUpdate, listener);
    return () => ipcRenderer.removeListener(IpcChannel.PopupUpdate, listener);
  },
  close: () => ipcRenderer.send(IpcChannel.PopupClose),
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('popupApi', api);
  } catch (err) {
    console.error(err);
  }
} else {
  (window as unknown as { popupApi: PopupApi }).popupApi = api;
}
