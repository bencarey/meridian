import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Visualizer } from './components/Visualizer'
import { ControlOverlay } from './components/ControlOverlay'
import { useAudioEngine } from './hooks/useAudioEngine'
import { useTimer } from './hooks/useTimer'
import { PRESETS, PresetId, DurationOption, Preset } from './types/audio'
import { randomQuote } from './data/quotes'
import { hexToRgb, rgbToHex, themeInk, luminance } from './utils/color'

interface MeetingInfo {
  title: string
  secondsUntil: number
}

interface QuoteData {
  text: string
  author: string
  meetingTitle?: string
}

function formatTime(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif"

function QuoteOverlay({
  data,
  visible,
  accentColor,
  fadeSpeed = '1.2s',
  isLight = false,
  onClick,
}: {
  data: QuoteData
  visible: boolean
  accentColor: string
  fadeSpeed?: string
  isLight?: boolean
  onClick?: () => void
}) {
  const ink = themeInk(isLight)
  const quoteColor = `rgba(${ink},${isLight ? 0.78 : 0.68})`
  const dividerColor = `rgba(${ink},0.12)`
  const meetingColor = `rgba(${ink},${isLight ? 0.42 : 0.35})`
  return (
    <div
      onClick={onClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 15,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 12%',
        cursor: onClick ? 'pointer' : 'default',
        opacity: visible ? 1 : 0,
        transition: `opacity ${fadeSpeed} ease`,
        pointerEvents: onClick ? 'auto' : 'none',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: '500px' }}>
        <div style={{ width: '24px', height: '1px', background: accentColor, opacity: 0.4, margin: '0 auto 26px' }} />
        <p style={{
          fontFamily: FONT,
          fontSize: '17px',
          fontWeight: 200,
          letterSpacing: '0.02em',
          lineHeight: 1.72,
          color: quoteColor,
          margin: '0 0 18px',
          fontStyle: 'italic',
        }}>
          "{data.text}"
        </p>
        <p style={{
          fontFamily: FONT,
          fontSize: '9px',
          fontWeight: 500,
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color: `${accentColor}88`,
          margin: data.meetingTitle ? '0 0 22px' : '0',
        }}>
          {data.author}
        </p>
        {data.meetingTitle && (
          <>
            <div style={{ width: '18px', height: '1px', background: dividerColor, margin: '0 auto 14px' }} />
            <p style={{
              fontFamily: FONT,
              fontSize: '9px',
              fontWeight: 500,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: meetingColor,
              margin: 0,
            }}>
              Time for · {data.meetingTitle}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function App(): React.JSX.Element {
  const [activePresetId, setActivePresetId] = useState<PresetId>('deep-focus')
  const [activeDuration, setActiveDuration] = useState<DurationOption>(25)
  const [volume, setVolumeState] = useState(0.1)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo | null>(null)

  // Opening quote — shown on load, fades out on BEGIN
  const [openingQuote, setOpeningQuote] = useState<QuoteData | null>(null)
  const [openingVisible, setOpeningVisible] = useState(false)
  const openingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Completion quote — shown when timer hits zero
  const [completionQuote, setCompletionQuote] = useState<QuoteData | null>(null)
  const [completionVisible, setCompletionVisible] = useState(false)
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Color state
  const [bgColor, setBgColor] = useState(PRESETS['deep-focus'].bgColor)
  const [orbColor, setOrbColor] = useState(PRESETS['deep-focus'].orbColor)
  const [accentColor, setAccentColor] = useState(PRESETS['deep-focus'].accentColor)
  const [particleColor, setParticleColor] = useState(PRESETS['deep-focus'].particleColor)

  const lerpBgRef = useRef({ from: [7, 9, 15] as [number, number, number], to: [7, 9, 15] as [number, number, number], t: 1 })
  const lerpOrbRef = useRef({ from: [26, 35, 126] as [number, number, number], to: [26, 35, 126] as [number, number, number], t: 1 })

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const audio = useAudioEngine()
  const timer = useTimer()

  const activePreset: Preset = PRESETS[activePresetId]

  // Show opening quote on mount
  useEffect(() => {
    const q = randomQuote()
    setOpeningQuote({ text: q.text, author: q.author })
    requestAnimationFrame(() => setOpeningVisible(true))
  }, [])

  // Fetch next calendar meeting
  const fetchMeeting = useCallback(async () => {
    try {
      const info = await window.api?.getNextMeeting?.()
      if (info && info.secondsUntil > 120 && info.secondsUntil < 86400) {
        setMeetingInfo(info)
        setActiveDuration((prev) => prev === 25 ? 'meeting' : prev)
      } else {
        setMeetingInfo(null)
        setActiveDuration((prev) => prev === 'meeting' ? 25 : prev)
      }
    } catch {
      setMeetingInfo(null)
    }
  }, [])

  useEffect(() => { fetchMeeting() }, [fetchMeeting])

  // Stop audio when hidden to tray
  useEffect(() => {
    window.api?.onStopAudio(() => {
      audio.stop()
      timer.resetTimer()
      setCompletionQuote(null)
      setCompletionVisible(false)
      window.api?.setPlaying(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Idle detection
  const resetIdleTimer = useCallback(() => {
    setControlsVisible(true)
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => setControlsVisible(false), 3000)
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', resetIdleTimer)
    window.addEventListener('mousedown', resetIdleTimer)
    window.addEventListener('keydown', resetIdleTimer)
    resetIdleTimer()
    return () => {
      window.removeEventListener('mousemove', resetIdleTimer)
      window.removeEventListener('mousedown', resetIdleTimer)
      window.removeEventListener('keydown', resetIdleTimer)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [resetIdleTimer])

  const startPresetTransition = useCallback((preset: Preset) => {
    lerpBgRef.current = { from: hexToRgb(bgColor), to: hexToRgb(preset.bgColor), t: 0 }
    lerpOrbRef.current = { from: hexToRgb(orbColor), to: hexToRgb(preset.orbColor), t: 0 }
    setAccentColor(preset.accentColor)
    setParticleColor(preset.particleColor)
  }, [bgColor, orbColor])

  const onVisualizerTick = useCallback(() => {
    const bg = lerpBgRef.current
    if (bg.t < 1) {
      const newT = Math.min(1, bg.t + 0.008)
      lerpBgRef.current = { ...bg, t: newT }
      setBgColor(rgbToHex(bg.from[0] + (bg.to[0] - bg.from[0]) * newT, bg.from[1] + (bg.to[1] - bg.from[1]) * newT, bg.from[2] + (bg.to[2] - bg.from[2]) * newT))
    }
    const orb = lerpOrbRef.current
    if (orb.t < 1) {
      const newT = Math.min(1, orb.t + 0.008)
      lerpOrbRef.current = { ...orb, t: newT }
      setOrbColor(rgbToHex(orb.from[0] + (orb.to[0] - orb.from[0]) * newT, orb.from[1] + (orb.to[1] - orb.from[1]) * newT, orb.from[2] + (orb.to[2] - orb.from[2]) * newT))
    }
  }, [])

  const dismissOpeningQuote = useCallback(() => {
    setOpeningVisible(false)
    if (openingTimeoutRef.current) clearTimeout(openingTimeoutRef.current)
    // Remove from DOM after fade-out completes
    openingTimeoutRef.current = setTimeout(() => setOpeningQuote(null), 3200)
  }, [])

  // Fires when timer hits zero
  const handleSessionComplete = useCallback(() => {
    audio.playChime()
    setTimeout(() => {
      const q = randomQuote()
      setCompletionQuote({
        text: q.text,
        author: q.author,
        meetingTitle: activeDuration === 'meeting' ? meetingInfo?.title : undefined,
      })
      requestAnimationFrame(() => setCompletionVisible(true))
    }, 500)
    completionTimeoutRef.current = setTimeout(() => {
      audio.stop()
      timer.resetTimer()
      window.api?.setPlaying(false)
    }, 3500)
  }, [audio, timer, activeDuration, meetingInfo])

  const handleDismissCompletion = useCallback(() => {
    setCompletionVisible(false)
    setTimeout(() => setCompletionQuote(null), 700)
    if (completionTimeoutRef.current) { clearTimeout(completionTimeoutRef.current); completionTimeoutRef.current = null }
    if (audio.isPlaying) { audio.stop(); timer.resetTimer(); window.api?.setPlaying(false) }
  }, [audio, timer])

  const handlePresetChange = useCallback((id: PresetId) => {
    const preset = PRESETS[id]
    setActivePresetId(id)
    startPresetTransition(preset)
    if (audio.isPlaying) { audio.stop(); setTimeout(() => audio.start(preset, volume), 200) }
  }, [audio, volume, startPresetTransition])

  const handleDurationChange = useCallback(async (d: DurationOption) => {
    setActiveDuration(d)
    if (d === 'meeting') await fetchMeeting()
  }, [fetchMeeting])

  const handleTogglePlay = useCallback(async () => {
    if (audio.isPlaying) {
      audio.stop()
      timer.resetTimer()
      setCompletionQuote(null)
      setCompletionVisible(false)
      if (completionTimeoutRef.current) { clearTimeout(completionTimeoutRef.current); completionTimeoutRef.current = null }
      window.api?.setPlaying(false)
    } else {
      // Fade out the opening quote slowly as music begins
      dismissOpeningQuote()

      await audio.start(activePreset, volume)
      if (activeDuration === 'meeting' && meetingInfo) {
        timer.startTimerSeconds(Math.max(60, meetingInfo.secondsUntil - 60), handleSessionComplete)
      } else {
        timer.startTimer(activeDuration, handleSessionComplete)
      }
      window.api?.setPlaying(true)
    }
  }, [audio, timer, activePreset, volume, activeDuration, meetingInfo, handleSessionComplete, dismissOpeningQuote])

  const handleVolumeChange = useCallback((v: number) => {
    setVolumeState(v)
    audio.setVolume(v)
  }, [audio])

  const headerTime = (() => {
    if (audio.isPlaying) return timer.secondsRemaining !== null ? formatTime(timer.secondsRemaining) : '∞'
    if (activeDuration === 'meeting' && meetingInfo) return formatTime(Math.max(0, meetingInfo.secondsUntil - 60))
    if (typeof activeDuration === 'number') return formatTime(activeDuration * 60)
    return null
  })()

  const isLight = activePreset.theme === 'light'

  // The header sits over the canvas, whose background color *lerps* between presets.
  // Pick its ink from the live background luminance (not the target theme) so the text
  // stays legible throughout the dark↔cream transition instead of flashing invisible.
  const headerLight = luminance(bgColor) > 140
  const headerInk = themeInk(headerLight)

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#0a0a08' }}>
      <Visualizer
        bgColor={bgColor}
        orbColor={orbColor}
        accentColor={accentColor}
        particleColor={particleColor}
        isPlaying={audio.isPlaying}
        geometrySpeed={activePreset.geometrySpeed ?? 1.0}
        geometryVariant={activePreset.geometryVariant ?? 'triangles'}
        theme={activePreset.theme ?? 'dark'}
        onTick={onVisualizerTick}
      />

      {/* Header */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '52px', zIndex: 30,
        display: 'flex', alignItems: 'center', paddingLeft: '80px', paddingRight: '24px',
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}>
        <span style={{
          fontSize: '11px', fontFamily: FONT, fontWeight: 500, letterSpacing: '0.25em',
          color: `rgba(${headerInk},${headerLight ? 0.78 : 0.65})`, textTransform: 'uppercase', userSelect: 'none',
          WebkitAppRegion: 'no-drag', transition: 'color 0.6s ease',
        } as React.CSSProperties}>
          Meridian
        </span>
        <div style={{ flex: 1 }} />
        {headerTime && (
          <span style={{
            fontSize: '13px', fontFamily: FONT, fontWeight: 200, letterSpacing: '0.05em',
            color: `rgba(${headerInk},${headerLight ? (audio.isPlaying ? 0.66 : 0.38) : (audio.isPlaying ? 0.60 : 0.28)})`,
            fontVariantNumeric: 'tabular-nums', userSelect: 'none',
            WebkitAppRegion: 'no-drag', transition: 'color 0.5s ease',
          } as React.CSSProperties}>
            {headerTime}
          </span>
        )}
      </div>

      {/* Opening quote — fades in on load, fades out slowly when BEGIN is clicked */}
      {openingQuote && (
        <QuoteOverlay
          data={openingQuote}
          visible={openingVisible}
          accentColor={accentColor}
          fadeSpeed="3s"
          isLight={isLight}
        />
      )}

      {/* Completion quote — fades in at session end, click to dismiss */}
      {completionQuote && (
        <QuoteOverlay
          data={completionQuote}
          visible={completionVisible}
          accentColor={accentColor}
          fadeSpeed="1.2s"
          isLight={isLight}
          onClick={handleDismissCompletion}
        />
      )}

      <ControlOverlay
        visible={controlsVisible}
        isPlaying={audio.isPlaying}
        isLight={isLight}
        activePreset={activePreset}
        activeDuration={activeDuration}
        volume={volume}
        secondsRemaining={timer.secondsRemaining}
        meetingInfo={meetingInfo}
        onPresetChange={handlePresetChange}
        onDurationChange={handleDurationChange}
        onTogglePlay={handleTogglePlay}
        onVolumeChange={handleVolumeChange}
      />
    </div>
  )
}

export default App
