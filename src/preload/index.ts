import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  setPlaying: (isPlaying: boolean): void => { ipcRenderer.send('set-playing', isPlaying) },
  setActivePreset: (presetId: string): void => { ipcRenderer.send('set-active-preset', presetId) },
  hideWindow: (): void => { ipcRenderer.send('hide-window') },
  onStopAudio: (cb: () => void): void => { ipcRenderer.on('stop-audio', cb) },
  onTraySelectPreset: (cb: (presetId: string) => void): void => {
    ipcRenderer.on('tray-select-preset', (_event, presetId: string) => cb(presetId))
  },
  onTrayTogglePlay: (cb: () => void): void => { ipcRenderer.on('tray-toggle-play', () => cb()) },
  getNextMeeting: (): Promise<{ title: string; secondsUntil: number } | null> =>
    ipcRenderer.invoke('get-next-meeting'),
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
