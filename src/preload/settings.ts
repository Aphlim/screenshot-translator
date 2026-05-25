import { contextBridge, ipcRenderer } from 'electron';
import {
  IpcChannel,
  type SettingsPayload,
  type SettingsTestResult,
  type SettingsTranslate,
} from '@shared/channels';

export interface SettingsApi {
  get: () => Promise<SettingsPayload>;
  save: (payload: SettingsPayload) => Promise<{ ok: true }>;
  testConnection: (cfg: SettingsTranslate) => Promise<SettingsTestResult>;
  openConfigFolder: () => void;
  close: () => void;
}

const api: SettingsApi = {
  get: () => ipcRenderer.invoke(IpcChannel.SettingsGet),
  save: (payload) => ipcRenderer.invoke(IpcChannel.SettingsSave, payload),
  testConnection: (cfg) => ipcRenderer.invoke(IpcChannel.SettingsTestConnection, cfg),
  openConfigFolder: () => ipcRenderer.send(IpcChannel.SettingsOpenConfigFolder),
  close: () => ipcRenderer.send(IpcChannel.SettingsClose),
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('settingsApi', api);
  } catch (err) {
    console.error(err);
  }
} else {
  (window as unknown as { settingsApi: SettingsApi }).settingsApi = api;
}
