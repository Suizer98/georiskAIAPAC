import { create } from 'zustand'

export type TravelAdvisoryItem = {
  country: string
  country_name?: string
  level: number | null
  error?: string
  retrieved_at?: string
}

/**
 * Single source of truth: any country code (State Dept API or ISO2) → ISO2.
 * - API codes (JA, CE, …) map to ISO2 for backend; ISO2 keys are identity (JP→JP).
 * - Backend receives this as api_code_to_iso2; map uses unique values for GeoJSON matching.
 */
export const COUNTRY_CODE_TO_ISO2: Record<string, string> = {
  CE: 'LK',
  KN: 'KP',
  KS: 'KR',
  KR: 'KS', //South Korea to avoid Kiribati
  RS: 'RU',
  BM: 'MM',
  BD: 'BM',
  BG: 'BD', // Bangladesh to avoid Bermuda
  PP: 'PG',
  CB: 'KH',
  RP: 'PH',
  TT: 'TL',
  BP: 'SB',
  VM: 'VN',
  JA: 'JP',
  AU: 'AU',
  BN: 'BN',
  KH: 'KH',
  CH: 'CN',
  HK: 'HK',
  IN: 'IN',
  ID: 'ID',
  JP: 'JP',
  LA: 'LA',
  MY: 'MY',
  MM: 'MM',
  NZ: 'NZ',
  KP: 'KP',
  PG: 'PG',
  PH: 'PH',
  RU: 'RU',
  SB: 'SB',
  SN: 'SG',
  LK: 'LK',
  TW: 'CN-TW',
  TH: 'TH',
  TL: 'TL',
  VN: 'VN',
}

/** APAC ISO2 codes for the map, derived from the dictionary. */
export const APAC_ISO2_CODES = [
  ...new Set(Object.values(COUNTRY_CODE_TO_ISO2)),
].sort()

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
      const response = await fetch('/api/travel_advisories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_code_to_iso2: COUNTRY_CODE_TO_ISO2 }),
        signal,
        referrerPolicy: 'same-origin',
        credentials: 'same-origin',
      })
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
