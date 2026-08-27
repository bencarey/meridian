import { useState, useRef, useCallback } from 'react'
import { Preset } from '../types/audio'

interface AudioEngine {
  isPlaying: boolean
  start: (preset: Preset, volume: number) => Promise<void>
  stop: () => void
  setVolume: (v: number) => void
  playChime: () => void
}

function createReverb(ctx: AudioContext, duration: number, decay: number): ConvolverNode {
  const sampleRate = ctx.sampleRate
  const length = sampleRate * duration
  const impulse = ctx.createBuffer(2, length, sampleRate)
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
    }
  }
  const convolver = ctx.createConvolver()
  convolver.buffer = impulse
  return convolver
}

function createBrownNoise(ctx: AudioContext): AudioBufferSourceNode {
  const bufferSize = ctx.sampleRate * 4
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let lastOut = 0
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1
    data[i] = (lastOut + 0.02 * white) / 1.02
    lastOut = data[i]
    data[i] *= 3.5
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  return source
}

function createPinkNoise(ctx: AudioContext): AudioBufferSourceNode {
  const bufferSize = ctx.sampleRate * 4
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + white * 0.0555179
    b1 = 0.99332 * b1 + white * 0.0750759
    b2 = 0.96900 * b2 + white * 0.1538520
    b3 = 0.86650 * b3 + white * 0.3104856
    b4 = 0.55000 * b4 + white * 0.5329522
    b5 = -0.7616 * b5 - white * 0.0168980
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
    b6 = white * 0.115926
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  return source
}

function createWhiteNoise(ctx: AudioContext): AudioBufferSourceNode {
  const bufferSize = ctx.sampleRate * 4
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.3
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  return source
}

// ── Trap-style beat layer (808 kick, hats, clap) ───────────────────────────

function makeSaturationCurve(amount: number): Float32Array {
  const samples = 256
  const curve = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1
    curve[i] = Math.tanh(amount * x)
  }
  return curve
}

function triggerKick808(ctx: AudioContext, master: GainNode, satCurve: Float32Array, time: number): void {
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(150, time)
  osc.frequency.exponentialRampToValueAtTime(46, time + 0.09)

  const shaper = ctx.createWaveShaper()
  shaper.curve = satCurve

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, time)
  gain.gain.linearRampToValueAtTime(0.9, time + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.55)

  osc.connect(shaper)
  shaper.connect(gain)
  gain.connect(master)
  osc.start(time)
  osc.stop(time + 0.6)
}

function triggerHat(ctx: AudioContext, buffer: AudioBuffer, master: GainNode, time: number, accent: boolean): void {
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = 7000 + Math.random() * 2000

  const gain = ctx.createGain()
  const peak = accent ? 0.22 : 0.12
  const decay = accent ? 0.09 : 0.045
  gain.gain.setValueAtTime(0, time)
  gain.gain.linearRampToValueAtTime(peak, time + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + decay)

  src.connect(filter)
  filter.connect(gain)
  gain.connect(master)
  src.start(time)
  src.stop(time + decay + 0.02)
}

function triggerClap(ctx: AudioContext, buffer: AudioBuffer, master: GainNode, time: number): void {
  const offsets = [0, 0.012, 0.024]
  offsets.forEach((off, i) => {
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1500
    filter.Q.value = 1.2

    const gain = ctx.createGain()
    const peak = 0.18 - i * 0.02
    gain.gain.setValueAtTime(0, time + off)
    gain.gain.linearRampToValueAtTime(peak, time + off + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + off + 0.09)

    src.connect(filter)
    filter.connect(gain)
    gain.connect(master)
    src.start(time + off)
    src.stop(time + off + 0.11)
  })
}

export function useAudioEngine(): AudioEngine {
  const [isPlaying, setIsPlaying] = useState(false)
  const ctxRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const isRunningRef = useRef(false)
  const schedulerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activePresetRef = useRef<Preset | null>(null)
  const reverbRef = useRef<ConvolverNode | null>(null)
  const padFilterRef = useRef<BiquadFilterNode | null>(null)
  const lfoRef = useRef<OscillatorNode | null>(null)
  const beatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopAll = useCallback(() => {
    isRunningRef.current = false
    if (schedulerTimerRef.current !== null) {
      clearTimeout(schedulerTimerRef.current)
      schedulerTimerRef.current = null
    }
    if (beatIntervalRef.current !== null) {
      clearInterval(beatIntervalRef.current)
      beatIntervalRef.current = null
    }
    if (ctxRef.current && masterGainRef.current) {
      const gain = masterGainRef.current
      const ctx = ctxRef.current
      gain.gain.cancelScheduledValues(ctx.currentTime)
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6)
      const capturedCtx = ctxRef.current
      ctxRef.current = null
      masterGainRef.current = null
      reverbRef.current = null
      padFilterRef.current = null
      lfoRef.current = null
      setTimeout(() => {
        capturedCtx.close()
      }, 800)
    }
    setIsPlaying(false)
  }, [])

  const playPadNote = useCallback(
    (ctx: AudioContext, preset: Preset, reverb: ConvolverNode, master: GainNode) => {
      if (!isRunningRef.current) return

      const scale = preset.scale
      // Pick 1-3 notes, preferring fourths/fifths (index gaps of 3 or 4)
      const noteCount = Math.random() < 0.4 ? 1 : Math.random() < 0.6 ? 2 : 3
      const rootIdx = Math.floor(Math.random() * scale.length)
      const indices: number[] = [rootIdx]

      if (noteCount >= 2) {
        // Try to add a fourth or fifth
        const preferredOffsets = [3, 4, -3, -4, 2, 5]
        for (const offset of preferredOffsets) {
          const candidate = rootIdx + offset
          if (candidate >= 0 && candidate < scale.length) {
            indices.push(candidate)
            break
          }
        }
        if (indices.length < 2) {
          const fallback = (rootIdx + 2) % scale.length
          indices.push(fallback)
        }
      }

      if (noteCount >= 3) {
        const usedSet = new Set(indices)
        for (let i = 0; i < scale.length; i++) {
          if (!usedSet.has(i)) {
            indices.push(i)
            break
          }
        }
      }

      const holdMin = preset.padHoldMin ?? 2
      const holdMax = preset.padHoldMax ?? 4
      const holdTime = holdMin + Math.random() * Math.max(0, holdMax - holdMin)
      const attackTime = preset.padAttack ?? 1.2
      const releaseTime = preset.padRelease ?? 3.0

      indices.forEach((idx) => {
        const freq = scale[idx]
        const osc = ctx.createOscillator()
        osc.type = Math.random() < 0.5 ? 'sine' : 'triangle'
        osc.frequency.value = freq

        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 800 + Math.random() * 400
        filter.Q.value = 0.7

        const noteGain = ctx.createGain()
        const targetGain = 0.08 + Math.random() * 0.04
        noteGain.gain.setValueAtTime(0, ctx.currentTime)
        noteGain.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + attackTime)
        noteGain.gain.setValueAtTime(targetGain, ctx.currentTime + attackTime + holdTime)
        noteGain.gain.linearRampToValueAtTime(0, ctx.currentTime + attackTime + holdTime + releaseTime)

        osc.connect(filter)
        filter.connect(noteGain)
        noteGain.connect(reverb)
        noteGain.connect(master)

        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + attackTime + holdTime + releaseTime + 0.1)
      })
    },
    []
  )

  const scheduleNextNote = useCallback(
    (ctx: AudioContext, preset: Preset, reverb: ConvolverNode, master: GainNode) => {
      if (!isRunningRef.current) return
      const delayMin = preset.noteDelayMin ?? 3000
      const delayMax = preset.noteDelayMax ?? 12000
      const delay = delayMin + Math.random() * Math.max(0, delayMax - delayMin)
      schedulerTimerRef.current = setTimeout(() => {
        if (!isRunningRef.current) return
        playPadNote(ctx, preset, reverb, master)
        scheduleNextNote(ctx, preset, reverb, master)
      }, delay)
    },
    [playPadNote]
  )

  const startBeatEngine = useCallback((ctx: AudioContext, preset: Preset, master: GainNode) => {
    const bpm = preset.beatBpm
    if (!bpm) return

    const beatGain = ctx.createGain()
    beatGain.gain.value = preset.beatGain ?? 0.4
    beatGain.connect(master)

    const satCurve = makeSaturationCurve(1.8)

    // Shared noise bed for hats/claps — one-shot buffer sources reuse it per hit
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const noiseData = noiseBuf.getChannelData(0)
    for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1

    const stepDuration = 60 / bpm / 4 // 16th notes
    const kickBaseSteps = [0, 3, 6, 10]
    let currentStep = 0
    let nextStepTime = ctx.currentTime + 0.1
    let barKickSteps = new Set(kickBaseSteps)

    beatIntervalRef.current = setInterval(() => {
      if (!isRunningRef.current) return
      const scheduleAhead = 0.12
      while (nextStepTime < ctx.currentTime + scheduleAhead) {
        if (currentStep === 0) {
          // Regenerate per-bar kick variation for generative feel
          barKickSteps = new Set(kickBaseSteps)
          if (Math.random() < 0.3) barKickSteps.add(13)
          if (Math.random() < 0.15) barKickSteps.delete(6)
        }

        if (barKickSteps.has(currentStep)) {
          triggerKick808(ctx, beatGain, satCurve, nextStepTime)
        }
        if (currentStep === 8) {
          triggerClap(ctx, noiseBuf, beatGain, nextStepTime)
        }
        if (currentStep % 2 === 0) {
          triggerHat(ctx, noiseBuf, beatGain, nextStepTime, currentStep % 4 === 0)
        } else if (Math.random() < 0.55) {
          triggerHat(ctx, noiseBuf, beatGain, nextStepTime, false)
        }

        currentStep = (currentStep + 1) % 16
        nextStepTime += stepDuration
      }
    }, 25)
  }, [])

  const start = useCallback(
    async (preset: Preset, volume: number): Promise<void> => {
      if (ctxRef.current) {
        stopAll()
        await new Promise((r) => setTimeout(r, 100))
      }

      const ctx = new AudioContext()
      ctxRef.current = ctx
      activePresetRef.current = preset
      isRunningRef.current = true

      const master = ctx.createGain()
      master.gain.setValueAtTime(0, ctx.currentTime)
      master.gain.linearRampToValueAtTime(volume, ctx.currentTime + 2.5)
      master.connect(ctx.destination)
      masterGainRef.current = master

      // --- Reverb ---
      const reverb = createReverb(ctx, 4, 2)
      const reverbGain = ctx.createGain()
      reverbGain.gain.value = preset.reverbMix ?? 0.6
      reverb.connect(reverbGain)
      reverbGain.connect(master)
      reverbRef.current = reverb

      // --- Binaural beats ---
      const binauralGainNode = ctx.createGain()
      binauralGainNode.gain.value = 0.06

      const leftOsc = ctx.createOscillator()
      leftOsc.frequency.value = preset.carrierLeft
      leftOsc.type = 'sine'
      const rightOsc = ctx.createOscillator()
      rightOsc.frequency.value = preset.carrierRight
      rightOsc.type = 'sine'

      const leftPanner = ctx.createStereoPanner()
      leftPanner.pan.value = -1
      const rightPanner = ctx.createStereoPanner()
      rightPanner.pan.value = 1

      leftOsc.connect(leftPanner)
      rightOsc.connect(rightPanner)
      leftPanner.connect(binauralGainNode)
      rightPanner.connect(binauralGainNode)
      binauralGainNode.connect(master)

      leftOsc.start()
      rightOsc.start()

      // --- Colored noise ---
      let noiseSource: AudioBufferSourceNode
      if (preset.noiseType === 'brown') {
        noiseSource = createBrownNoise(ctx)
      } else if (preset.noiseType === 'pink') {
        noiseSource = createPinkNoise(ctx)
      } else {
        noiseSource = createWhiteNoise(ctx)
      }
      const noiseGain = ctx.createGain()
      noiseGain.gain.value = preset.noiseGain ?? 0.12
      const noiseFilter = ctx.createBiquadFilter()
      noiseFilter.type = 'lowpass'
      noiseFilter.frequency.value = 1200
      noiseSource.connect(noiseFilter)
      noiseFilter.connect(noiseGain)
      noiseGain.connect(master)
      noiseSource.start()

      // --- Sub-bass drone ---
      if (preset.droneHz) {
        const droneOsc = ctx.createOscillator()
        droneOsc.type = 'sine'
        droneOsc.frequency.value = preset.droneHz
        const droneGain = ctx.createGain()
        droneGain.gain.value = 0.04
        droneOsc.connect(droneGain)
        droneGain.connect(master)
        droneOsc.start()
      }

      // --- Pad synth with LFO filter modulation ---
      const padFilter = ctx.createBiquadFilter()
      padFilter.type = 'lowpass'
      padFilter.frequency.value = 1000
      padFilter.Q.value = 0.7
      padFilterRef.current = padFilter

      const lfo = ctx.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.value = 0.08 + Math.random() * 0.07
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 200
      lfo.connect(lfoGain)
      lfoGain.connect(padFilter.frequency)
      lfo.start()
      lfoRef.current = lfo

      // Play first note immediately, then schedule
      playPadNote(ctx, preset, reverb, master)
      scheduleNextNote(ctx, preset, reverb, master)

      startBeatEngine(ctx, preset, master)

      setIsPlaying(true)
    },
    [stopAll, playPadNote, scheduleNextNote, startBeatEngine]
  )

  const stop = useCallback(() => {
    stopAll()
  }, [stopAll])

  const setVolume = useCallback((v: number) => {
    if (masterGainRef.current && ctxRef.current) {
      masterGainRef.current.gain.setTargetAtTime(v, ctxRef.current.currentTime, 0.1)
    }
  }, [])

  // Tibetan singing bowl — fundamental + detuned twin for shimmer + inharmonic partial
  const playChime = useCallback(() => {
    const ctx = new AudioContext()

    // Long, spacious reverb for bowl resonance
    const reverb = createReverb(ctx, 6, 1.4)
    const reverbGain = ctx.createGain()
    reverbGain.gain.value = 0.6
    reverb.connect(reverbGain)
    reverbGain.connect(ctx.destination)

    // 432 Hz (meditative A) + twin 2.4 Hz apart = slow shimmer beating
    // 432 × 2.756 = 1190 Hz = characteristic inharmonic partial of a struck bowl
    const voices = [
      { freq: 432.0, gain: 0.16, decay: 9.5 },
      { freq: 434.4, gain: 0.08, decay: 9.0 },  // ~2.4 Hz beat → gentle shimmer
      { freq: 1190,  gain: 0.05, decay: 6.0 },  // inharmonic 2nd partial
    ]

    const t0 = ctx.currentTime + 0.05
    for (const { freq, gain, decay } of voices) {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      // Soft mallet-like attack — bowl blooms rather than clicks
      g.gain.setValueAtTime(0, t0)
      g.gain.linearRampToValueAtTime(gain, t0 + 0.12)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay)
      osc.connect(g)
      g.connect(ctx.destination)
      g.connect(reverb)
      osc.start(t0)
      osc.stop(t0 + decay + 0.1)
    }

    setTimeout(() => ctx.close(), 14000)
  }, [])

  return { isPlaying, start, stop, setVolume, playChime }
}
