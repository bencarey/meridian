import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      setPlaying: (isPlaying: boolean) => void
      setActivePreset: (presetId: string) => void
      hideWindow: () => void
      onStopAudio: (cb: () => void) => void
      onTraySelectPreset: (cb: (presetId: string) => void) => void
      onTrayTogglePlay: (cb: () => void) => void
      getNextMeeting: () => Promise<{ title: string; secondsUntil: number } | null>
    }
  }
}
