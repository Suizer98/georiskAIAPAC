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

export const useRadarStore = create<RadarState>((set) => ({
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

// When polling is true, interval only runs if the first fetch returns non-empty data.
// If data is [], we fetch once and do not poll (avoids hammering when OpenSky is unreachable).
export async function startRadarPolling(polling = false) {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  await useRadarStore.getState().fetchRadar()
  if (polling && useRadarStore.getState().data.length > 0) {
    pollTimer = setInterval(() => useRadarStore.getState().fetchRadar(), RADAR_POLL_MS)
  }
}

export function stopRadarPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}
