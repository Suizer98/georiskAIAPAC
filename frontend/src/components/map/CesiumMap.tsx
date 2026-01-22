import { type CSSProperties, useEffect, useRef } from 'react'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { useRiskStore } from '../../store/riskStore'
import { usePriceStore } from '../../store/priceStore'
import { useLayerStore } from '../../store/layerStore'
import { useCesiumViewer } from './useCesiumViewer'
import { useRiskLayer } from './useRiskLayer'
import { usePriceLayer } from './usePriceLayer'

type CesiumMapProps = {
  className?: string
  style?: CSSProperties
}

export default function CesiumMap({ className, style }: CesiumMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewerRef = useCesiumViewer(containerRef)
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

  useRiskLayer(viewerRef, riskData, riskLayerEnabled)
  usePriceLayer(viewerRef, priceData, priceLayerEnabled)

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
    />
  )
}
