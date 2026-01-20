import { create } from 'zustand'

export type RiskItem = {
  id: number
  country?: string
  city?: string
  latitude: number
  longitude: number
  risk_level: number
  updated_at?: string
}

type RiskState = {
  data: RiskItem[]
  loading: boolean
  error: string | null
  streamConnected: boolean
  fetchRisk: (signal?: AbortSignal) => Promise<void>
}

let riskEventSource: EventSource | null = null

export const useRiskStore = create<RiskState>((set) => ({
  data: [],
  loading: false,
  error: null,
  streamConnected: false,
  fetchRisk: async (signal) => {
    set({ loading: true, error: null })
    try {
      const response = await fetch('/api/risk', { signal })
      if (!response.ok) {
        throw new Error(`Failed to load risk data (${response.status})`)
      }
      const payload = await response.json()
      set({ data: Array.isArray(payload) ? payload : [] })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        set({ loading: false })
        return
      }
      set({ error: 'Unable to load risk data.' })
    } finally {
      set({ loading: false })
    }
  },
}))

export const startRiskStream = () => {
  if (riskEventSource) {
    return
  }
  useRiskStore.getState().fetchRisk()
  const source = new EventSource('/api/risk/events')
  riskEventSource = source
  useRiskStore.setState({ streamConnected: true })
  source.onmessage = () => {
    useRiskStore.getState().fetchRisk()
  }
  source.onerror = () => {
    useRiskStore.setState({ streamConnected: false })
  }
}

export const stopRiskStream = () => {
  if (riskEventSource) {
    riskEventSource.close()
    riskEventSource = null
  }
  useRiskStore.setState({ streamConnected: false })
}
