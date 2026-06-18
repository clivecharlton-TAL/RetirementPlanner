import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  loadScenario: () => ipcRenderer.invoke('load-scenario'),
  saveScenario: (name: string, inputsJson: string, expensesJson: string) =>
    ipcRenderer.invoke('save-scenario', name, inputsJson, expensesJson),
  exportXlsx: (base64: string, defaultName: string) =>
    ipcRenderer.invoke('export-xlsx', base64, defaultName),

  aiHasKey: () => ipcRenderer.invoke('ai-has-key'),
  aiSaveKey: (key: string) => ipcRenderer.invoke('ai-save-key', key),
  aiSend: (messages: unknown, contextJson: string) =>
    ipcRenderer.send('ai-send', messages, contextJson),
  onAiChunk: (cb: (text: string) => void) =>
    ipcRenderer.on('ai-chunk', (_e, text) => cb(text)),
  onAiDone: (cb: () => void) =>
    ipcRenderer.on('ai-done', cb),
  offAiListeners: () => {
    ipcRenderer.removeAllListeners('ai-chunk');
    ipcRenderer.removeAllListeners('ai-done');
  },
});
