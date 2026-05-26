import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannel, type HistoryEntry } from '@shared/channels';

export interface HistoryApi {
  get: () => Promise<HistoryEntry[]>;
  deleteOne: (id: string) => Promise<{ ok: boolean }>;
  clear: () => Promise<{ ok: boolean }>;
  copy: (text: string) => void;
  close: () => void;
}

const api: HistoryApi = {
  get: () => ipcRenderer.invoke(IpcChannel.HistoryGet),
  deleteOne: (id) => ipcRenderer.invoke(IpcChannel.HistoryDeleteOne, id),
  clear: () => ipcRenderer.invoke(IpcChannel.HistoryClear),
  copy: (text) => ipcRenderer.send(IpcChannel.HistoryCopy, text),
  close: () => ipcRenderer.send(IpcChannel.HistoryClose),
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('historyApi', api);
  } catch (err) {
    console.error(err);
  }
} else {
  (window as unknown as { historyApi: HistoryApi }).historyApi = api;
}
