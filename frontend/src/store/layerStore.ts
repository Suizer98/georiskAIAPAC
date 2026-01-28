import { create } from 'zustand'

export type MapLayer = {
  id: 'risk' | 'price' | 'jpmorgan' | 'travel_advisory'
  label: string
  enabled: boolean
}

type LayerState = {
  layers: MapLayer[]
  toggleLayer: (id: MapLayer['id']) => void
  setLayer: (id: MapLayer['id'], enabled: boolean) => void
}

export const useLayerStore = create<LayerState>((set) => ({
  layers: [
    { id: 'risk', label: 'Risk Heatmap', enabled: true },
    { id: 'travel_advisory', label: 'Travel Advisory Levels', enabled: true },
    { id: 'price', label: 'Metals Price', enabled: false },
    { id: 'jpmorgan', label: 'JP Morgan Offices', enabled: false },
  ],
  toggleLayer: (id) =>
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === id
          ? { ...layer, enabled: !layer.enabled }
          : layer
      ),
    })),
  setLayer: (id, enabled) =>
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === id ? { ...layer, enabled } : layer
      ),
    })),
}))
