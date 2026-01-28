import { create } from 'zustand'

export type JPMorganOffice = {
  id: number
  city: string
  country: string
  address: string
  latitude: number
  longitude: number
  office_type?: string
  phone?: string
}

type JPMorganState = {
  data: JPMorganOffice[]
  loading: boolean
  error: string | null
  fetchOffices: (signal?: AbortSignal) => Promise<void>
}

// Sample JP Morgan offices in APAC region
const APAC_OFFICES: JPMorganOffice[] = [
  {
    id: 1,
    city: 'Hong Kong',
    country: 'China',
    address: '25/F, Chater House, 8 Connaught Road Central',
    latitude: 22.2819,
    longitude: 114.1558,
    office_type: 'Investment Banking',
  },
  {
    id: 2,
    city: 'Singapore',
    country: 'Singapore',
    address: '168 Robinson Road, #20-01 Capital Tower',
    latitude: 1.2801,
    longitude: 103.8509,
    office_type: 'Investment Banking',
  },
  {
    id: 3,
    city: 'Tokyo',
    country: 'Japan',
    address: 'Marunouchi Park Building, 2-6-1 Marunouchi, Chiyoda-ku',
    latitude: 35.6812,
    longitude: 139.7671,
    office_type: 'Investment Banking',
  },
  {
    id: 4,
    city: 'Sydney',
    country: 'Australia',
    address: 'Level 25, 60 Martin Place',
    latitude: -33.8688,
    longitude: 151.2093,
    office_type: 'Investment Banking',
  },
  {
    id: 5,
    city: 'Mumbai',
    country: 'India',
    address: 'J.P. Morgan Tower, C-59, G-Block, Bandra Kurla Complex',
    latitude: 19.0604,
    longitude: 72.8777,
    office_type: 'Investment Banking',
  },
  {
    id: 6,
    city: 'Shanghai',
    country: 'China',
    address: '45/F, Shanghai IFC, 8 Century Avenue, Pudong New Area',
    latitude: 31.2304,
    longitude: 121.4737,
    office_type: 'Investment Banking',
  },
  {
    id: 7,
    city: 'Seoul',
    country: 'South Korea',
    address: '23F, Seoul Finance Center, 84 Taepyeongno 1-ga, Jung-gu',
    latitude: 37.5665,
    longitude: 126.9780,
    office_type: 'Investment Banking',
  },
  {
    id: 8,
    city: 'Bangkok',
    country: 'Thailand',
    address: '20/F, Sathorn Square, 98 North Sathorn Road',
    latitude: 13.7279,
    longitude: 100.5331,
    office_type: 'Investment Banking',
  },
  {
    id: 9,
    city: 'Jakarta',
    country: 'Indonesia',
    address: '33rd Floor, World Trade Center, Jl. Jend. Sudirman Kav. 29-31',
    latitude: -6.2088,
    longitude: 106.8456,
    office_type: 'Investment Banking',
  },
  {
    id: 10,
    city: 'Manila',
    country: 'Philippines',
    address: '12/F, Tower 1, RCBC Plaza, 6819 Ayala Avenue, Makati',
    latitude: 14.5547,
    longitude: 121.0244,
    office_type: 'Investment Banking',
  },
]

export const useJPMorganStore = create<JPMorganState>((set) => ({
  data: [],
  loading: false,
  error: null,
  fetchOffices: async (signal) => {
    set({ loading: true, error: null })
    try {
      // Try to fetch from API first, fallback to hardcoded data
      try {
        const response = await fetch('/api/jpmorgan', { signal })
        if (response.ok) {
          const payload = await response.json()
          const items = Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload)
              ? payload
              : []
          if (items.length > 0) {
            set({ data: items })
            return
          }
        }
      } catch (apiError) {
        // API not available, use hardcoded data
        console.warn('JP Morgan API not available, using hardcoded data:', apiError)
      }
      
      // Fallback to hardcoded data
      set({ data: APAC_OFFICES })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        set({ loading: false })
        return
      }
      set({ error: 'Unable to load JP Morgan offices data.' })
    } finally {
      set({ loading: false })
    }
  },
}))
