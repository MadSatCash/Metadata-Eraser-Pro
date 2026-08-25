const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const cleaner = require('./src/cleaner');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 500,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#121212',
      symbolColor: '#ffffff'
    },
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#121212'
  });

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.maximize();
  
  // Intercept links to open in external browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handler to clean images
ipcMain.handle('clean-images', async (event, filePaths) => {
  const results = [];
  for (const filePath of filePaths) {
    try {
      const { resultPath, removedTags } = await cleaner.cleanMetadata(filePath);
      results.push({ path: filePath, success: true, resultPath, removedTags });
    } catch (error) {
      results.push({ path: filePath, success: false, error: error.message });
    }
  }
  return results;
});

