import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannel } from '@shared/channels';
import type { AppApi } from '@shared/types';

const api: AppApi = {
  ping: () => ipcRenderer.invoke(IpcChannel.Ping),
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  (window as Window & { api: AppApi }).api = api;
}
