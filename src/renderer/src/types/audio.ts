export type PresetId = 'deep-focus' | 'flow-state' | 'creative' | 'power' | 'build' | 'minimalist' | 'wabi-sabi';
export type DurationOption = 25 | 45 | 60 | 90 | 'meeting' | null;

export interface Preset {
  id: PresetId;
  name: string;
  label: string;
  description: string;
  binauralHz: number;
  carrierLeft: number;
  carrierRight: number;
  noiseType: 'brown' | 'pink' | 'white';
  droneHz?: number;
  scale: number[];     // frequencies in Hz
  rootNote: number;    // root note freq for sub-bass
  geometrySpeed?: number;
  geometryVariant?: 'triangles' | 'circles' | 'mandala' | 'crystalline' | 'grid' | 'minimal' | 'wabi';
  theme?: 'dark' | 'light';   // visual theme — default 'dark'
  // Optional generative-audio overrides (defaults applied in useAudioEngine)
  padAttack?: number;         // s, note fade-in  (default 1.2)
  padRelease?: number;        // s, note fade-out (default 3.0)
  noteDelayMin?: number;      // ms, min gap between pad notes (default 3000)
  noteDelayMax?: number;      // ms, max gap between pad notes (default 12000)
  noiseGain?: number;         // colored-noise level (default 0.12)
  reverbMix?: number;         // reverb send level  (default 0.6)
  bgColor: string;
  orbColor: string;
  accentColor: string;
  particleColor: string;
}

export const PRESETS: Record<PresetId, Preset> = {
  'deep-focus': {
    id: 'deep-focus',
    name: 'DEEP FOCUS',
    label: 'DEEP',
    description: 'Theta waves for deep concentration',
    binauralHz: 6,
    carrierLeft: 200,
    carrierRight: 206,
    noiseType: 'brown',
    droneHz: 73.42, // D2
    scale: [146.83, 164.81, 185.00, 220.00, 246.94, 293.66, 329.63, 369.99],
    rootNote: 146.83,
    geometryVariant: 'triangles',
    bgColor: '#07090F',
    orbColor: '#1A237E',
    accentColor: '#5C6BC0',
    particleColor: 'rgba(92,107,192,0.6)',
  },
  'flow-state': {
    id: 'flow-state',
    name: 'FLOW STATE',
    label: 'FLOW',
    description: 'Alpha waves for effortless flow',
    binauralHz: 10,
    carrierLeft: 200,
    carrierRight: 210,
    noiseType: 'pink',
    droneHz: 98.00, // G2
    scale: [196.00, 220.00, 246.94, 293.66, 329.63, 392.00, 440.00, 493.88],
    rootNote: 196.00,
    geometryVariant: 'circles',
    bgColor: '#071209',
    orbColor: '#1B5E20',
    accentColor: '#66BB6A',
    particleColor: 'rgba(102,187,106,0.5)',
  },
  'creative': {
    id: 'creative',
    name: 'CREATIVE',
    label: 'CREATE',
    description: 'Alpha-theta border for creative insight',
    binauralHz: 8,
    carrierLeft: 200,
    carrierRight: 208,
    noiseType: 'pink',
    droneHz: 110.00, // A2
    scale: [220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33],
    rootNote: 220.00,
    geometryVariant: 'mandala',
    bgColor: '#0F0714',
    orbColor: '#4A148C',
    accentColor: '#AB47BC',
    particleColor: 'rgba(171,75,188,0.5)',
  },
  'power': {
    id: 'power',
    name: 'POWER',
    label: 'POWER',
    description: 'Beta waves for peak performance',
    binauralHz: 18,
    carrierLeft: 200,
    carrierRight: 218,
    noiseType: 'white',
    droneHz: 82.41, // E2
    scale: [164.81, 196.00, 220.00, 246.94, 293.66, 329.63, 392.00, 440.00],
    rootNote: 164.81,
    geometryVariant: 'crystalline',
    bgColor: '#0F0704',
    orbColor: '#BF360C',
    accentColor: '#FF7043',
    particleColor: 'rgba(255,112,67,0.5)',
  },
  'build': {
    id: 'build',
    name: 'BUILD',
    label: 'BUILD',
    description: 'Gamma waves for intense technical focus',
    binauralHz: 40,
    carrierLeft: 200,
    carrierRight: 240,
    noiseType: 'brown',
    droneHz: 65.41,  // C2 — deep, grounding
    scale: [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25],
    rootNote: 130.81,
    geometrySpeed: 1.55,
    geometryVariant: 'grid',
    bgColor: '#06090E',
    orbColor: '#0A2038',
    accentColor: '#00B4D8',
    particleColor: 'rgba(0,180,216,0.5)',
  },
  'minimalist': {
    id: 'minimalist',
    name: 'MINIMALIST',
    label: 'MNMLST',
    description: 'Ambient minimalism — warm, modern, generative calm',
    binauralHz: 7.83,        // Schumann resonance — grounding theta
    carrierLeft: 180,        // low, warm carrier
    carrierRight: 187.83,    // 7.83 Hz binaural difference
    noiseType: 'pink',
    noiseGain: 0.05,         // barely-there warm texture
    droneHz: 65.41,          // C2 — warm, grounding
    scale: [130.81, 146.83, 164.81, 196.00, 220.00, 261.63, 293.66, 329.63], // C major pentatonic (C D E G A) — warm mid register
    rootNote: 130.81,        // C3
    padAttack: 2.6,          // slow Eno-style bloom
    padRelease: 6.5,         // long ambient tails
    noteDelayMin: 5000,      // sparse — lots of space
    noteDelayMax: 16000,
    reverbMix: 0.85,         // wet, spacious washes
    geometrySpeed: 0.6,      // slow, calm motion
    geometryVariant: 'minimal',
    theme: 'light',
    bgColor: '#F2EFE7',      // warm cream (Anthropic-style)
    orbColor: '#E6DFD0',     // soft warm sand glow
    accentColor: '#33312C',  // warm graphite ink (Rams restraint)
    particleColor: 'rgba(80,76,68,0.30)', // subtle dark specks
  },
  'wabi-sabi': {
    id: 'wabi-sabi',
    name: 'WABI-SABI',
    label: 'WABI',
    description: 'Japandi stillness — imperfect, impermanent, contemplative',
    binauralHz: 5.5,         // deep theta — meditative stillness
    carrierLeft: 170,        // low, woody carrier
    carrierRight: 175.5,     // 5.5 Hz binaural difference
    noiseType: 'brown',
    noiseGain: 0.04,         // soft, earthy warmth
    droneHz: 55.00,          // A1 — deep, grounding
    scale: [220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33], // A minor pentatonic (A C D E G) — warm, wistful
    rootNote: 220.00,        // A3
    padAttack: 3.5,          // very slow brush-like bloom
    padRelease: 8.0,         // long, impermanent decay
    noteDelayMin: 7000,      // very sparse — negative space (ma)
    noteDelayMax: 20000,
    reverbMix: 0.9,          // deep temple-hall resonance
    geometrySpeed: 0.45,     // very slow, still
    geometryVariant: 'wabi',
    theme: 'light',
    bgColor: '#E9E2D4',      // warm oatmeal / unbleached clay
    orbColor: '#D8CDB8',     // soft taupe glow
    accentColor: '#3A352C',  // warm sumi-ink charcoal
    particleColor: 'rgba(90,80,64,0.22)', // earthy dust motes
  },
};

export const PRESET_ORDER: PresetId[] = ['deep-focus', 'flow-state', 'creative', 'power', 'build', 'minimalist', 'wabi-sabi'];
