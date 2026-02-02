import { create } from 'zustand'

export type GdeltHotspot = {
  latitude: number
  longitude: number
  count: number
}

type GdeltState = {
  data: GdeltHotspot[]
  query: string
  loading: boolean
  error: string | null
  streamConnected: boolean
  lastEvent: { type?: string; at?: string; query?: string } | null
  lastSnapshot: string | null
  fetchGdelt: (signal?: AbortSignal) => Promise<void>
}

const GDELT_DEFAULT_QUERY = 'military'

let gdeltEventSource: EventSource | null = null
const GDELT_RECONNECT_DELAY_MS = 2000

export const useGdeltStore = create<GdeltState>((set) => ({
  data: [],
  query: GDELT_DEFAULT_QUERY,
  loading: false,
  error: null,
  streamConnected: false,
  lastEvent: null,
  lastSnapshot: null,
  // Data comes from backend DB (seeded on startup). No query/timespan params; AI or POST /api/gdelt updates display and backend broadcasts gdelt_updated (and risk updates also trigger refetch).
  fetchGdelt: async (signal) => {
    set({ loading: true, error: null })
    try {
      const url = `/api/gdelt?_t=${Date.now()}`
      const response = await fetch(url, { signal })
      if (!response.ok) {
        throw new Error(`Failed to load GDELT data (${response.status})`)
      }
      const payload = await response.json()
      const features = Array.isArray(payload.features) ? payload.features : []
      const nextQuery = payload.query ?? GDELT_DEFAULT_QUERY
      set((state) => {
        const snapshot = JSON.stringify({ q: nextQuery, len: features.length })
        const hasChanged =
          state.lastSnapshot !== null && snapshot !== state.lastSnapshot
        return {
          data: features,
          query: nextQuery,
          error: null,
          lastSnapshot: snapshot,
          lastEvent: hasChanged
            ? {
                type: 'gdelt_updated',
                at: new Date().toISOString(),
                query: nextQuery,
              }
            : state.lastEvent,
        }
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        set({ loading: false })
        return
      }
      // Keep last data in memory on error (same as risk) so layer does not dim when connection is lost
      set({ error: 'Unable to load GDELT hotspots.' })
    } finally {
      set({ loading: false })
    }
  },
}))

function connectGdeltStream() {
  if (gdeltEventSource) return
  useGdeltStore.getState().fetchGdelt()
  const source = new EventSource('/api/gdelt/events')
  gdeltEventSource = source
  useGdeltStore.setState({ streamConnected: true })
  source.onmessage = () => {
    useGdeltStore.getState().fetchGdelt()
  }
  source.onerror = () => {
    useGdeltStore.setState({ streamConnected: false })
    source.close()
    gdeltEventSource = null
    setTimeout(() => connectGdeltStream(), GDELT_RECONNECT_DELAY_MS)
  }
}

export function startGdeltStream() {
  if (gdeltEventSource) return
  connectGdeltStream()
}

export function stopGdeltStream() {
  if (gdeltEventSource) {
    gdeltEventSource.close()
    gdeltEventSource = null
  }
  useGdeltStore.setState({ streamConnected: false })
}
