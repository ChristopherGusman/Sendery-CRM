const { app, BrowserWindow, session } = require('electron')
const path = require('path')

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Sendery CRM",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  // Esto es necesario para que la base de datos (sql.js) no falle
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Cross-Origin-Opener-Policy': ['same-origin'],
        'Cross-Origin-Embedder-Policy': ['require-corp']
      }
    });
  });

  win.loadFile(path.join(__dirname, 'dist/index.html'))
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})