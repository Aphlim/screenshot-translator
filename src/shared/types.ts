export interface AppApi {
  ping: () => Promise<string>;
}

declare global {
  interface Window {
    api: AppApi;
  }
}

export {};
