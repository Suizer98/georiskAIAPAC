import { create } from 'zustand'

export type TravelAdvisoryItem = {
  country: string
  level: number | null // 1, 2, 3, or 4
  error?: string
  retrieved_at?: string
}

type TravelAdvisoryState = {
  data: TravelAdvisoryItem[]
  loading: boolean
  error: string | null
  fetchTravelAdvisories: (signal?: AbortSignal) => Promise<void>
}

export const useTravelAdvisoryStore = create<TravelAdvisoryState>((set) => ({
  data: [],
  loading: false,
  error: null,
  fetchTravelAdvisories: async (signal) => {
    set({ loading: true, error: null })
    try {
      const response = await fetch('/api/travel_advisories', { signal })
      if (!response.ok) {
        throw new Error(`Failed to load travel advisories (${response.status})`)
      }
      const payload = await response.json()
      const items = Array.isArray(payload.items) ? payload.items : []
      set({ data: items })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        set({ loading: false })
        return
      }
      set({ error: 'Unable to load travel advisories.' })
    } finally {
      set({ loading: false })
    }
  },
}))
