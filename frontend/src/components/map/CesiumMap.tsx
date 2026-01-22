import { type CSSProperties, useEffect, useRef, useState, useCallback } from 'react'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { useRiskStore } from '../../store/riskStore'
import { usePriceStore } from '../../store/priceStore'
import { useLayerStore } from '../../store/layerStore'
import { useCesiumViewer } from './useCesiumViewer'
import { useRiskLayer } from './useRiskLayer'
import { usePriceLayer } from './usePriceLayer'
import MapPopup, { type MapPopupSelection } from './MapPopup'

type CesiumMapProps = {
  className?: string
  style?: CSSProperties
}

export default function CesiumMap({ className, style }: CesiumMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewerRef = useCesiumViewer(containerRef)
  const [popupData, setPopupData] = useState<MapPopupSelection | null>(null)

  const riskData = useRiskStore((state) => state.data)
  const fetchRisk = useRiskStore((state) => state.fetchRisk)
  const priceData = usePriceStore((state) => state.data)
  const fetchPrices = usePriceStore((state) => state.fetchPrices)
  const riskLayerEnabled = useLayerStore(
    (state) => state.layers.find((layer) => layer.id === 'risk')?.enabled ?? true
  )
  const priceLayerEnabled = useLayerStore(
    (state) =>
      state.layers.find((layer) => layer.id === 'price')?.enabled ?? false
  )

  const handleSelect = useCallback((data: MapPopupSelection | null) => {
    setPopupData(data)
  }, [])

  useRiskLayer(viewerRef, riskData, riskLayerEnabled, handleSelect)
  usePriceLayer(viewerRef, priceData, priceLayerEnabled, handleSelect)

  useEffect(() => {
    const controller = new AbortController()
    fetchRisk(controller.signal)
    fetchPrices(controller.signal)
    return () => controller.abort()
  }, [fetchRisk, fetchPrices])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        ...style,
      }}
    >
      {popupData && (
        <MapPopup
          x={popupData.x}
          y={popupData.y}
          payload={popupData.payload}
          onClose={() => setPopupData(null)}
        />
      )}
    </div>
  )
}
