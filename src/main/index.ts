import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { exec } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

// ── APP SETUP ─────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let forceQuit = false
let isPlaying = false

// Kept in sync with PRESET_ORDER / Preset.name in src/renderer/src/types/audio.ts
const TRAY_PRESETS: { id: string; label: string }[] = [
  { id: 'deep-focus', label: 'DEEP FOCUS' },
  { id: 'creative', label: 'CREATIVE' },
  { id: 'power', label: 'POWER' },
  { id: 'build', label: 'BUILD' },
  { id: 'minimalist', label: 'MINIMALIST' },
  { id: 'wabi-sabi', label: 'WABI-SABI' },
]
let activePresetId = TRAY_PRESETS[0].id

function buildTrayMenu(): Menu {
  return Menu.buildFromTemplate([
    ...TRAY_PRESETS.map((preset) => ({
      label: preset.label,
      type: 'radio' as const,
      checked: preset.id === activePresetId,
      click: () => mainWindow?.webContents.send('tray-select-preset', preset.id),
    })),
    { type: 'separator' as const },
    {
      label: isPlaying ? 'Pause' : 'Play',
      click: () => mainWindow?.webContents.send('tray-toggle-play'),
    },
    { type: 'separator' as const },
    {
      label: 'Show Meridian',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      },
    },
    { type: 'separator' as const },
    {
      label: 'Quit Meridian',
      click: () => {
        forceQuit = true
        app.quit()
      },
    },
  ])
}

function updateTray(): void {
  tray?.setContextMenu(buildTrayMenu())
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 20 },
    backgroundColor: '#0A0A08',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  // X button hides the window — audio keeps playing, re-open from Dock
  mainWindow.on('close', (event) => {
    if (!forceQuit && process.platform === 'darwin') {
      event.preventDefault()
      mainWindow!.webContents.send('stop-audio')
      mainWindow!.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.bencarey.meridian')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // ── Menu bar tray ───────────────────────────────────────────────────────
  const trayIconPath = is.dev
    ? join(__dirname, '../../resources/icon.png')
    : join(process.resourcesPath, 'icon.png')
  tray = new Tray(nativeImage.createFromPath(trayIconPath).resize({ width: 18, height: 18 }))
  tray.setToolTip('Meridian')
  updateTray()

  // ── IPC handlers ────────────────────────────────────────────────────────
  ipcMain.on('hide-window', () => {
    mainWindow?.hide()
  })

  ipcMain.on('set-playing', (_event, playing: boolean) => {
    isPlaying = playing
    updateTray()
  })

  ipcMain.on('set-active-preset', (_event, presetId: string) => {
    activePresetId = presetId
    updateTray()
  })

  ipcMain.handle('get-next-meeting', async () => {
    return new Promise<{ title: string; secondsUntil: number } | null>((resolve) => {
      // Use bundled Objective-C EventKit helper — works with any calendar source
      // (Google Calendar via Notion Calendar, iCloud, Exchange, etc.)
      const helperPath = is.dev
        ? join(__dirname, '../../resources/meridian-cal')
        : join(process.resourcesPath, 'meridian-cal')

      const timer = setTimeout(() => resolve(null), 10000)

      exec(`"${helperPath}"`, (err, stdout) => {
        clearTimeout(timer)
        if (err || !stdout || stdout.trim() === 'none') { resolve(null); return }
        const raw = stdout.trim()
        const sep = raw.lastIndexOf('|')
        if (sep === -1) { resolve(null); return }
        const title = raw.slice(0, sep)
        const secs = parseInt(raw.slice(sep + 1), 10)
        if (!title || isNaN(secs) || secs <= 0) { resolve(null); return }
        resolve({ title, secondsUntil: secs })
      })
    })
  })

  createWindow()

  // Clicking the Dock icon shows the window
  app.on('activate', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    } else {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  forceQuit = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
