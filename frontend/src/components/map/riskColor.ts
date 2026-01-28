// Helper function to convert hex to RGB
const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [0, 0, 0]
}

// Helper function to interpolate between two colors
const lerpColor = (
  color1: [number, number, number],
  color2: [number, number, number],
  t: number
): [number, number, number] => {
  return [
    Math.round(color1[0] + (color2[0] - color1[0]) * t),
    Math.round(color1[1] + (color2[1] - color1[1]) * t),
    Math.round(color1[2] + (color2[2] - color1[2]) * t),
  ]
}

// Convert RGB array to hex string
const rgbToHex = (rgb: [number, number, number]): string => {
  return `#${rgb[0].toString(16).padStart(2, '0')}${rgb[1]
    .toString(16)
    .padStart(2, '0')}${rgb[2].toString(16).padStart(2, '0')}`
}

export const riskColor = (risk: number): string => {
  const clamped = Math.max(0, Math.min(100, risk))
  const t = clamped / 100
  const low = hexToRgb('#22c55e') // green
  const mid = hexToRgb('#f59e0b') // amber
  const high = hexToRgb('#ef4444') // red

  if (t < 0.5) {
    return rgbToHex(lerpColor(low, mid, t * 2))
  }
  return rgbToHex(lerpColor(mid, high, (t - 0.5) * 2))
}
