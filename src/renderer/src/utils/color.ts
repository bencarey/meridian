// Shared color helpers used by App.tsx (preset lerp) and Visualizer.tsx (canvas strokes).

export function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return [0, 0, 0]
  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0'))
      .join('')
  )
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${Math.max(0, a)})`
}

// Foreground "ink" rgb triplet for a theme — use as `rgba(${themeInk(isLight)}, a)`
// or `rgb(${themeInk(isLight)})`. Single source of truth for light/dark text color.
export function themeInk(isLight: boolean): string {
  return isLight ? '40,37,30' : '255,255,255'
}

// Perceived luminance (0–255) of a hex color, for picking legible ink over a background.
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return 0.299 * r + 0.587 * g + 0.114 * b
}
