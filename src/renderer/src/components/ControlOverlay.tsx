import { Preset, PresetId, DurationOption, PRESETS, PRESET_ORDER } from '../types/audio'

interface MeetingInfo {
  title: string
  secondsUntil: number
}

interface ControlOverlayProps {
  visible: boolean
  isPlaying: boolean
  isLight?: boolean
  activePreset: Preset
  activeDuration: DurationOption
  volume: number
  secondsRemaining: number | null
  meetingInfo: MeetingInfo | null
  onPresetChange: (id: PresetId) => void
  onDurationChange: (d: DurationOption) => void
  onTogglePlay: () => void
  onVolumeChange: (v: number) => void
}

const DURATIONS: { label: string; value: DurationOption }[] = [
  { label: '25', value: 25 },
  { label: '45', value: 45 },
  { label: '60', value: 60 },
  { label: '90', value: 90 },
  { label: '∞', value: null },
]

function getBrainState(hz: number): { symbol: string; name: string } {
  if (hz < 4)  return { symbol: 'δ', name: 'DELTA' }
  if (hz < 8)  return { symbol: 'θ', name: 'THETA' }
  if (hz < 12) return { symbol: 'α', name: 'ALPHA' }
  if (hz < 30) return { symbol: 'β', name: 'BETA' }
  return { symbol: 'γ', name: 'GAMMA' }
}

function formatMtgLabel(secondsUntil: number): string {
  const mins = Math.floor((secondsUntil - 60) / 60)
  if (mins <= 0) return 'MTG'
  return `~${mins}m`
}

const NOISE_LABEL: Record<string, string> = {
  brown: 'BROWN', pink: 'PINK', white: 'WHITE',
}

const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif"

function Divider({ ink }: { ink: string }) {
  return (
    <div style={{
      width: 1,
      height: 16,
      background: `rgba(${ink},0.10)`,
      flexShrink: 0,
      margin: '0 20px',
    }} />
  )
}

export function ControlOverlay({
  visible, isPlaying, isLight = false, activePreset, activeDuration, volume,
  secondsRemaining, meetingInfo, onPresetChange, onDurationChange, onTogglePlay, onVolumeChange,
}: ControlOverlayProps) {
  const accent = activePreset.accentColor
  const brain = getBrainState(activePreset.binauralHz)
  const noiseLabel = NOISE_LABEL[activePreset.noiseType] ?? activePreset.noiseType.toUpperCase()

  // Theme tokens — `ink` is the foreground rgb triplet for the active theme
  const ink = isLight ? '40,37,30' : '255,255,255'
  const barBg = isLight ? 'rgba(244,241,233,0.92)' : 'rgba(6, 6, 5, 0.94)'
  const barBorder = isPlaying ? `${accent}55` : `rgba(${ink},${isLight ? 0.1 : 0.07})`
  const iconColor = isLight ? '#28251e' : 'white'

  const baseText: React.CSSProperties = {
    fontFamily: FONT,
    fontSize: '10px',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    userSelect: 'none',
  }

  const meetingActive = activeDuration === 'meeting'

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 20,
        opacity: visible ? 1 : 0.10,
        transition: 'opacity 0.9s ease, background 0.6s ease, border-color 0.6s ease',
        background: barBg,
        borderTop: `1px solid ${barBorder}`,
      } as React.CSSProperties}
    >
      {/* ── TECHNICAL DATA STRIP ─────────────────────────────────── */}
      <div
        style={{
          overflow: 'hidden',
          maxHeight: isPlaying ? '34px' : '0px',
          opacity: isPlaying ? 1 : 0,
          transition: 'max-height 0.5s ease, opacity 0.5s ease',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 24px 0',
          }}
        >
          <span style={{ ...baseText, fontSize: '10px', color: accent, letterSpacing: '0.20em', fontWeight: 500 }}>
            {activePreset.name}
          </span>
          <span style={{ color: `rgba(${ink},0.15)`, fontSize: '10px', fontFamily: FONT }}>·</span>
          <span style={{ ...baseText, color: `rgba(${ink},0.50)` }}>
            {brain.symbol}&thinsp;{brain.name}
          </span>
          <span style={{ color: `rgba(${ink},0.15)`, fontSize: '10px', fontFamily: FONT }}>·</span>
          <span style={{ ...baseText, color: `rgba(${ink},0.50)` }}>
            {activePreset.binauralHz} Hz binaural
          </span>
          <span style={{ color: `rgba(${ink},0.15)`, fontSize: '10px', fontFamily: FONT }}>·</span>
          <span style={{ ...baseText, color: `rgba(${ink},0.35)` }}>
            carrier {activePreset.carrierLeft} / {activePreset.carrierRight} Hz
          </span>
          <span style={{ color: `rgba(${ink},0.15)`, fontSize: '10px', fontFamily: FONT }}>·</span>
          <span style={{ ...baseText, color: `rgba(${ink},0.35)` }}>
            {noiseLabel} noise
          </span>
          {meetingActive && meetingInfo && (
            <>
              <span style={{ color: `rgba(${ink},0.15)`, fontSize: '10px', fontFamily: FONT }}>·</span>
              <span style={{ ...baseText, color: `${accent}bb`, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {meetingInfo.title}
              </span>
            </>
          )}
          <div style={{ flex: 1 }} />
          {secondsRemaining !== null && (
            <span style={{
              fontFamily: FONT,
              fontSize: '11px',
              fontWeight: 300,
              letterSpacing: '0.06em',
              color: `rgba(${ink},0.45)`,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {String(Math.floor(secondsRemaining / 60)).padStart(2, '0')}:{String(secondsRemaining % 60).padStart(2, '0')}
            </span>
          )}
        </div>
        <div style={{ height: 1, background: `rgba(${ink},0.05)`, margin: '10px 24px 0' }} />
      </div>

      {/* ── CONTROL ROW ───────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '14px 24px 20px',
        }}
      >
        {/* Preset selector */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {PRESET_ORDER.map((id) => {
            const preset = PRESETS[id]
            const active = activePreset.id === id
            return (
              <button
                key={id}
                onClick={() => onPresetChange(id)}
                aria-label={`Switch to ${preset.name}`}
                style={{
                  ...baseText,
                  background: active ? `rgba(${ink},0.06)` : 'transparent',
                  border: 'none',
                  color: active ? accent : `rgba(${ink},0.28)`,
                  padding: '5px 10px',
                  cursor: 'pointer',
                  borderRadius: '2px',
                  transition: 'color 0.25s ease, background 0.25s ease',
                  fontWeight: active ? 500 : 400,
                }}
              >
                {preset.label}
              </button>
            )
          })}
        </div>

        <Divider ink={ink} />

        {/* Duration selector */}
        <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
          {DURATIONS.map(({ label, value }) => {
            const active = activeDuration === value
            return (
              <button
                key={label}
                onClick={() => onDurationChange(value)}
                aria-label={`Set duration to ${label}`}
                style={{
                  ...baseText,
                  fontSize: '10px',
                  letterSpacing: '0.08em',
                  background: active ? `rgba(${ink},0.06)` : 'transparent',
                  border: 'none',
                  color: active ? `rgba(${ink},0.80)` : `rgba(${ink},0.25)`,
                  padding: '5px 9px',
                  cursor: 'pointer',
                  borderRadius: '2px',
                  transition: 'color 0.25s ease, background 0.25s ease',
                  minWidth: '30px',
                  textAlign: 'center',
                  fontWeight: active ? 500 : 400,
                }}
              >
                {label}
              </button>
            )
          })}

          {/* MTG button — shown only when a meeting is auto-detected via EventKit */}
          {meetingInfo && (
            <button
              onClick={() => onDurationChange('meeting')}
              aria-label="Set duration to next meeting"
              title={meetingInfo.title}
              style={{
                ...baseText,
                fontSize: '10px',
                letterSpacing: '0.08em',
                background: meetingActive ? `${accent}18` : 'transparent',
                border: meetingActive ? `1px solid ${accent}44` : '1px solid transparent',
                color: meetingActive ? accent : `rgba(${ink},0.28)`,
                padding: '4px 9px',
                cursor: 'pointer',
                borderRadius: '2px',
                transition: 'color 0.25s ease, background 0.25s ease, border-color 0.25s ease',
                minWidth: '36px',
                textAlign: 'center',
                fontWeight: meetingActive ? 500 : 400,
                marginLeft: '4px',
              }}
            >
              {meetingActive ? formatMtgLabel(meetingInfo.secondsUntil) : 'MTG'}
            </button>
          )}
        </div>

        <Divider ink={ink} />

        {/* Volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '110px' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, opacity: 0.45 }}>
            <path d="M1 4.5H3L6 2V10L3 7.5H1V4.5Z" fill={iconColor} />
            <path d="M8 4C8.8 4.6 9.2 5.3 9.2 6C9.2 6.7 8.8 7.4 8 8" stroke={iconColor} strokeWidth="0.9" strokeLinecap="round" />
          </svg>
          <input
            type="range" min={0} max={1} step={0.01} value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            style={{
              flex: 1,
              appearance: 'none',
              WebkitAppearance: 'none',
              height: '2px',
              background: `linear-gradient(to right, ${accent} ${volume * 100}%, rgba(${ink},0.12) ${volume * 100}%)`,
              borderRadius: '1px',
              outline: 'none',
              cursor: 'pointer',
            } as React.CSSProperties}
          />
        </div>

        <Divider ink={ink} />

        {/* Begin / End */}
        <button
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'End session' : 'Begin session'}
          style={{
            ...baseText,
            fontSize: '10px',
            letterSpacing: '0.22em',
            fontWeight: 500,
            background: isPlaying ? 'transparent' : `${accent}18`,
            border: isPlaying ? `1px solid ${accent}88` : `1px solid ${accent}44`,
            color: isPlaying ? accent : `${accent}cc`,
            padding: '7px 20px',
            borderRadius: '2px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            whiteSpace: 'nowrap',
          }}
        >
          {isPlaying ? 'END' : 'BEGIN'}
        </button>
      </div>
    </div>
  )
}
