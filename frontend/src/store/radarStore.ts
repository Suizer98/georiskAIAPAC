import { create } from 'zustand'

export type RadarStateItem = {
  icao24: string | null
  callsign: string | null
  latitude: number
  longitude: number
  baro_altitude: number | null
  // Heading in degrees (0 = north, clockwise).
  true_track: number | null
}

type RadarState = {
  data: RadarStateItem[]
  loading: boolean
  error: string | null
  fetchRadar: (signal?: AbortSignal) => Promise<void>
}

const RADAR_POLL_MS = 15000

export const useRadarStore = create<RadarState>((set, get) => ({
  data: [],
  loading: false,
  error: null,
  fetchRadar: async (signal) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`/api/opensky/states?_t=${Date.now()}`, {
        signal,
      })
      if (!res.ok) throw new Error(`OpenSky ${res.status}`)
      const raw = await res.json()
      const data: RadarStateItem[] = Array.isArray(raw)
        ? raw.map((r: Record<string, unknown>) => ({
            icao24: (r.icao24 as string) ?? null,
            callsign: (r.callsign as string) ?? null,
            latitude: Number(r.latitude),
            longitude: Number(r.longitude),
            baro_altitude:
              r.baro_altitude != null ? Number(r.baro_altitude) : null,
            true_track: r.true_track != null ? Number(r.true_track) : null,
          }))
        : []
      set({ data, error: null })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        set({ loading: false })
        return
      }
      set({ error: 'Unable to load flight data.' })
    } finally {
      set({ loading: false })
    }
  },
}))

let pollTimer: ReturnType<typeof setTimeout> | null = null

// Default polling is false for rate limit
export function startRadarPolling(polling = false) {
  const fetch = () => useRadarStore.getState().fetchRadar()
  fetch()
  if (pollTimer) clearInterval(pollTimer)
  if (polling) pollTimer = setInterval(fetch, RADAR_POLL_MS)
}

export function stopRadarPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}
