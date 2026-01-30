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
  fetchGdelt: (signal?: AbortSignal, query?: string) => Promise<void>
}

export const useGdeltStore = create<GdeltState>((set) => ({
  data: [],
  query: 'military',
  loading: false,
  error: null,
  fetchGdelt: async (signal, query = 'military') => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams({ query, timespan: '48h' })
      const response = await fetch(`/api/gdelt?${params}`, { signal })
      if (!response.ok) {
        throw new Error(`Failed to load GDELT data (${response.status})`)
      }
      const payload = await response.json()
      const features = Array.isArray(payload.features) ? payload.features : []
      set({
        data: features,
        query: payload.query ?? query,
        error: null,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        set({ loading: false })
        return
      }
      set({ error: 'Unable to load GDELT hotspots.', data: [] })
    } finally {
      set({ loading: false })
    }
  },
}))
