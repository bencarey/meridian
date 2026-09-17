# Meridian

A focus soundscape app for macOS. Generative ambient music, sacred geometry visuals, and binaural beats — tuned to five states of mind.

---

## Presets

| Mode | Hz | Wave | Sound |
|---|---|---|---|
| **Deep** | 6 Hz | θ Theta | Brown noise · D2 drone |
| **Flow** | 10 Hz | α Alpha | Pink noise · G2 drone |
| **Create** | 8 Hz | α/θ | Pink noise · A2 drone |
| **Power** | 18 Hz | β Beta | White noise · E2 drone |
| **Build** | 40 Hz | γ Gamma | Brown noise · C2 drone |

Each preset generates binaural beats at the target frequency, a pentatonic pad synth that evolves over time, a sub-bass drone, and a unique sacred geometry visualization that builds progressively as the session deepens.

## Features

- **Five geometry variants** — Sri Yantra nested triangles, Flower of Life / Vesica Piscis, bezier petal mandala, 3D rotating octahedron, Metatron's Cube with circuit-board overlay
- **Generative audio** — stochastic pentatonic chord scheduler, algorithmic reverb, LFO filter modulation, colored noise, sub-bass drone
- **Calendar integration** — detects your next meeting and offers a countdown to 1 minute before it starts
- **Session complete** — Tibetan singing bowl chime (432 Hz, 9.5s decay) and a quote from the Stoics or Naval Ravikant
- **Opening quote** — a quote fades in on launch and dissolves slowly as the session begins
- **Menu bar** — animated tray icon while playing; window close hides to tray rather than quitting

## Install

1. Download `Meridian-1.1.8.dmg` from the [latest release](../../releases/latest)
2. Open the DMG and drag **Meridian** to **Applications**
3. Open **Terminal** and run:
   ```bash
   xattr -dr com.apple.quarantine "/Applications/Meridian.app"
   ```
4. Launch **Meridian** from Applications

> The app is ad-hoc signed but not notarized. Step 3 removes the macOS quarantine flag — it's a one-time step. Without it, macOS will silently refuse to launch the app.

## Usage

- **Preset** — select a focus mode from the bottom bar
- **Duration** — choose 25 / 45 / 60 / 90 min, ∞, or **MTG** (auto-set to your next calendar meeting)
- **Volume** — starts at 10%; use the slider to adjust
- **BEGIN / END** — start or stop the session
- Controls fade after 3 seconds of inactivity; move the mouse to bring them back
- Left-click the menu bar icon to show/hide the window

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build:mac
```

Output: `dist/Meridian-1.1.8.dmg`
