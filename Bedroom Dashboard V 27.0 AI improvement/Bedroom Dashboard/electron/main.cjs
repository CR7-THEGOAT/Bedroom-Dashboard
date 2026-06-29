const { app, BrowserWindow, globalShortcut, Menu, shell } = require('electron');
const path = require('node:path');

const DEV_URL = process.env.BEDROOM_DASHBOARD_HOME_URL || 'http://127.0.0.1:5173';
let mainWindow = null;

async function applyStoredShellSettings(window) {
  try {
    const browserSettings = await window.webContents.executeJavaScript(`(() => {
      try {
        return JSON.parse(localStorage.getItem('bedroom-dashboard.settings.v2') || '{}').browser || {};
      } catch {
        return {};
      }
    })()`);
    if (browserSettings.kioskLock) {
      window.setKiosk(true);
      return;
    }
    window.setFullScreen(browserSettings.fullscreen !== false);
  } catch {
    // The shell still works with normal window controls if settings cannot be read.
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#071012',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.removeMenu();
  mainWindow.loadURL(app.isPackaged
    ? `file://${path.join(__dirname, '..', 'dist', 'index.html')}`
    : DEV_URL);

  mainWindow.webContents.once('did-finish-load', () => applyStoredShellSettings(mainWindow));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(DEV_URL)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  globalShortcut.register('CommandOrControl+Shift+Q', () => app.quit());
  globalShortcut.register('F11', () => {
    if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
  });
  globalShortcut.register('CommandOrControl+R', () => mainWindow?.webContents.reload());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => globalShortcut.unregisterAll());
