import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import { loadScenario, saveScenario } from './db';
import { hasApiKey, saveApiKey, streamAiResponse } from './ai';

if (started) app.quit();

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f8f6f1',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
};

ipcMain.handle('load-scenario', () => loadScenario());
ipcMain.handle('save-scenario', (_event, name: string, inputsJson: string, expensesJson: string) =>
  saveScenario(name, inputsJson, expensesJson)
);

ipcMain.handle('export-xlsx', async (_event, base64: string, defaultName: string) => {
  const { filePath, canceled } = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
  });
  if (canceled || !filePath) return false;
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  return true;
});

ipcMain.handle('ai-has-key', () => hasApiKey());
ipcMain.handle('ai-save-key', (_event, key: string) => saveApiKey(key));
ipcMain.on('ai-send', (event, messages, contextJson: string) => {
  streamAiResponse(
    messages,
    contextJson,
    (text) => event.sender.send('ai-chunk', text),
    ()     => event.sender.send('ai-done'),
    (msg)  => { event.sender.send('ai-chunk', msg); event.sender.send('ai-done'); }
  );
});

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
