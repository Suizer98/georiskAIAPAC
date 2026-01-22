import { create } from 'zustand'

export type PriceItem = {
  country: string
  currency: string | null
  latitude: number
  longitude: number
  gold_usd: number | null
  silver_usd: number | null
  gold_local: number | null
  silver_local: number | null
  fx_rate: number | null
  retrieved_at?: string
}

type PriceState = {
  data: PriceItem[]
  loading: boolean
  error: string | null
  fetchPrices: (signal?: AbortSignal) => Promise<void>
}

export const usePriceStore = create<PriceState>((set) => ({
  data: [],
  loading: false,
  error: null,
  fetchPrices: async (signal) => {
    set({ loading: true, error: null })
    try {
      const response = await fetch('/api/price', { signal })
      if (!response.ok) {
        throw new Error(`Failed to load price data (${response.status})`)
      }
      const payload = await response.json()
      const items = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
          ? payload
          : []
      set({ data: items })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        set({ loading: false })
        return
      }
      set({ error: 'Unable to load price data.' })
    } finally {
      set({ loading: false })
    }
  },
}))
