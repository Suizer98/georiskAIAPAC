import { useState, useMemo } from 'react'
import { LayersIcon, Cross2Icon } from '@radix-ui/react-icons'
import * as Tooltip from '@radix-ui/react-tooltip'
import { useLocation } from 'react-router-dom'
import { useLayerStore } from '../../store/layerStore'
import { useRiskStore } from '../../store/riskStore'
import { usePriceStore } from '../../store/priceStore'
import { useJPMorganStore } from '../../store/jpmorganStore'
import { useTravelAdvisoryStore } from '../../store/travelAdvisoryStore'

type LegendItem = {
  id: 'risk' | 'jpmorgan' | 'price' | 'travel_advisory'
  displayName: string
  layerTitle: string
  iconColor: string
  iconBorderColor: string
}

export default function LayerListWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()
  const layers = useLayerStore((state) => state.layers)
  const toggleLayer = useLayerStore((state) => state.toggleLayer)
  
  // Get loading states and data from stores
  const riskLoading = useRiskStore((state) => state.loading)
  const riskData = useRiskStore((state) => state.data)
  const priceLoading = usePriceStore((state) => state.loading)
  const priceData = usePriceStore((state) => state.data)
  const jpmorganLoading = useJPMorganStore((state) => state.loading)
  const jpmorganData = useJPMorganStore((state) => state.data)
  const travelAdvisoryLoading = useTravelAdvisoryStore((state) => state.loading)
  const travelAdvisoryData = useTravelAdvisoryStore((state) => state.data)
  
  // Map layer IDs to their loading states
  // A layer is considered loading if:
  // 1. It's actively loading, OR
  // 2. It's enabled but has no data yet (initial load state)
  const getLayerLoading = (id: 'risk' | 'jpmorgan' | 'price' | 'travel_advisory') => {
    const isEnabled = layers.find((layer) => layer.id === id)?.enabled ?? false
    
    switch (id) {
      case 'risk':
        return riskLoading || (isEnabled && riskData.length === 0)
      case 'price':
        return priceLoading || (isEnabled && priceData.length === 0)
      case 'jpmorgan':
        return jpmorganLoading || (isEnabled && jpmorganData.length === 0)
      case 'travel_advisory':
        return travelAdvisoryLoading || (isEnabled && travelAdvisoryData.length === 0)
      default:
        return false
    }
  }

  // Determine which legend items to show based on route
  const legendItems = useMemo<LegendItem[]>(() => {
    const isPriceRoute = location.pathname.startsWith('/price')
    
    if (isPriceRoute) {
      return [
        {
          id: 'price',
          displayName: 'Gold',
          layerTitle: 'Metals Price',
          iconColor: '#d4af37',
          iconBorderColor: 'rgba(0, 0, 0, 0.3)',
        },
      ]
    }
    
    // Risk route
    return [
      {
        id: 'travel_advisory',
        displayName: 'Travel Advisory Levels',
        layerTitle: 'Travel Advisory Levels',
        iconColor: '#6b7280', // Gray default, will vary by level
        iconBorderColor: 'rgba(255, 255, 255, 0.3)',
      },
      {
        id: 'jpmorgan',
        displayName: 'JP Morgan Offices',
        layerTitle: 'JP Morgan Offices',
        iconColor: '#0066cc',
        iconBorderColor: 'rgba(255, 255, 255, 0.3)',
      },
      {
        id: 'risk',
        displayName: 'Risk Heatmap',
        layerTitle: 'Risk Heatmap',
        iconColor: '#f97316',
        iconBorderColor: 'rgba(255, 255, 255, 0.3)',
      },
    ]
  }, [location.pathname])

  // Get layer visibility state
  const getLayerVisibility = (id: 'risk' | 'jpmorgan' | 'price' | 'travel_advisory') => {
    return layers.find((layer) => layer.id === id)?.enabled ?? false
  }

  return (
    <>
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="fixed top-[100px] right-[15px] z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-slate-900/90 text-white shadow-lg backdrop-blur-sm hover:bg-slate-800/90"
              aria-label={isOpen ? 'Hide legend' : 'Show legend'}
            >
              {isOpen ? (
                <Cross2Icon className="h-5 w-5" />
              ) : (
                <LayersIcon className="h-5 w-5" />
              )}
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="left"
              className="z-50 rounded-lg bg-slate-900/95 px-3 py-2 text-sm text-white shadow-lg"
            >
              {isOpen ? 'Hide legend' : 'Show legend'}
              <Tooltip.Arrow className="fill-slate-900/95" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
      
      {/* Custom Legend */}
      {isOpen && (
        <div className="fixed top-[150px] right-[15px] z-40 w-[250px] rounded-lg border border-white/15 bg-slate-900/90 backdrop-blur-sm shadow-lg">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <LayersIcon className="h-4 w-4 text-white/80" />
              <span className="text-xs font-medium text-white/80">Layers</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-white/10 text-white/60 hover:text-white/80"
              aria-label="Close legend"
            >
              <Cross2Icon className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="px-3 py-2 space-y-2">
            {legendItems.map((item) => {
              const isVisible = getLayerVisibility(item.id)
              const isLoading = getLayerLoading(item.id)
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-2 text-sm transition-opacity ${
                    isLoading ? 'opacity-40' : 'opacity-100'
                  }`}
                >
                  {/* Legend Icon */}
                  <div
                    className="flex-shrink-0 w-3 h-3 rounded-full border"
                    style={{
                      backgroundColor: item.iconColor,
                      borderColor: item.iconBorderColor,
                    }}
                  />
                  {/* Layer Name */}
                  <span className={`flex-1 text-xs ${isLoading ? 'text-white/50' : 'text-white/90'}`}>
                    {item.displayName}
                  </span>
                  {/* Visibility Toggle Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!isLoading) {
                        toggleLayer(item.id)
                      }
                    }}
                    disabled={isLoading}
                    className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
                      isLoading
                        ? 'cursor-not-allowed opacity-40'
                        : 'hover:bg-white/10 text-white/60 hover:text-white/80'
                    }`}
                    aria-label={isVisible ? `Hide ${item.displayName}` : `Show ${item.displayName}`}
                  >
                    {isVisible ? (
                      <svg
                        className="h-4 w-4 text-white/60 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-4 w-4 text-white/40 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
