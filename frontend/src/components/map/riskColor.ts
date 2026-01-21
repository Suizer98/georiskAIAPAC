import { Color } from 'cesium'

export const riskColor = (risk: number) => {
  const clamped = Math.max(0, Math.min(100, risk))
  const t = clamped / 100
  const low = Color.fromCssColorString('#22c55e')
  const mid = Color.fromCssColorString('#f59e0b')
  const high = Color.fromCssColorString('#ef4444')
  if (t < 0.5) {
    return Color.lerp(low, mid, t * 2, new Color())
  }
  return Color.lerp(mid, high, (t - 0.5) * 2, new Color())
}
