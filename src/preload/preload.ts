import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  loadScenario: () => ipcRenderer.invoke('load-scenario'),
  saveScenario: (name: string, inputsJson: string, expensesJson: string) =>
    ipcRenderer.invoke('save-scenario', name, inputsJson, expensesJson),
});
