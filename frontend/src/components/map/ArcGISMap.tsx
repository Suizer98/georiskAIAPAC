import { type CSSProperties, useEffect, useRef, useState, useCallback } from 'react'
import '@arcgis/core/assets/esri/themes/dark/main.css'
import { useRiskStore } from '../../store/riskStore'
import { usePriceStore } from '../../store/priceStore'
import { useJPMorganStore } from '../../store/jpmorganStore'
import { useLayerStore } from '../../store/layerStore'
import { useArcGISViewer } from './useArcGISViewer'
import { useArcGISRiskLayer } from './useArcGISRiskLayer'
import { useArcGISPriceLayer } from './useArcGISPriceLayer'
import { useArcGISJPMorganLayer } from './useArcGISJPMorganLayer'
import LayerListWidget from './LayerListWidget'
import MapPopup, { type MapPopupSelection } from './MapPopup'

type ArcGISMapProps = {
  className?: string
  style?: CSSProperties
}

export default function ArcGISMap({ className, style }: ArcGISMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useArcGISViewer(containerRef)
  const [popupData, setPopupData] = useState<MapPopupSelection | null>(null)
  const popupRef = useRef<MapPopupSelection | null>(null)

  const riskData = useRiskStore((state) => state.data)
  const fetchRisk = useRiskStore((state) => state.fetchRisk)
  const priceData = usePriceStore((state) => state.data)
  const fetchPrices = usePriceStore((state) => state.fetchPrices)
  const jpmorganData = useJPMorganStore((state) => state.data)
  const fetchJPMorgan = useJPMorganStore((state) => state.fetchOffices)
  const riskLayerEnabled = useLayerStore(
    (state) => state.layers.find((layer) => layer.id === 'risk')?.enabled ?? true
  )
  const priceLayerEnabled = useLayerStore(
    (state) =>
      state.layers.find((layer) => layer.id === 'price')?.enabled ?? false
  )
  const jpmorganLayerEnabled = useLayerStore(
    (state) =>
      state.layers.find((layer) => layer.id === 'jpmorgan')?.enabled ?? false
  )

  const handleSelect = useCallback((data: MapPopupSelection | null) => {
    setPopupData(data)
  }, [])

  useArcGISRiskLayer(viewRef, riskData, riskLayerEnabled, handleSelect)
  useArcGISPriceLayer(viewRef, priceData, priceLayerEnabled, handleSelect)
  useArcGISJPMorganLayer(viewRef, jpmorganData, jpmorganLayerEnabled, handleSelect)

  // Initial fetch on mount
  useEffect(() => {
    const controller = new AbortController()
    fetchRisk(controller.signal)
    fetchPrices(controller.signal)
    fetchJPMorgan(controller.signal)
    return () => controller.abort()
  }, [fetchRisk, fetchPrices, fetchJPMorgan])

  // Refetch when layer becomes enabled
  useEffect(() => {
    const controller = new AbortController()
    if (riskLayerEnabled) {
      fetchRisk(controller.signal)
    }
    return () => controller.abort()
  }, [riskLayerEnabled, fetchRisk])

  useEffect(() => {
    const controller = new AbortController()
    if (priceLayerEnabled) {
      fetchPrices(controller.signal)
    }
    return () => controller.abort()
  }, [priceLayerEnabled, fetchPrices])

  useEffect(() => {
    const controller = new AbortController()
    if (jpmorganLayerEnabled) {
      fetchJPMorgan(controller.signal)
    }
    return () => controller.abort()
  }, [jpmorganLayerEnabled, fetchJPMorgan])

  useEffect(() => {
    popupRef.current = popupData
  }, [popupData])

  useEffect(() => {
    const updatePopupPosition = () => {
      const view = viewRef.current
      if (!view) {
        return
      }
      const current = popupRef.current
      if (!current?.position) {
        return
      }

      const screenPoint = view.toScreen(current.position)
      if (!screenPoint) {
        return
      }

      const rect = view.container.getBoundingClientRect()
      const nextX = rect.left + screenPoint.x
      const nextY = rect.top + screenPoint.y

      if (Math.abs(current.x - nextX) < 0.5 && Math.abs(current.y - nextY) < 0.5) {
        return
      }

      setPopupData({
        ...current,
        x: nextX,
        y: nextY,
      })
    }

    const view = viewRef.current
    if (!view) {
      return
    }

    const watchHandle = view.watch('stationary', () => {
      if (view.stationary) {
        updatePopupPosition()
      }
    })

    const animationHandle = view.watch('animation', () => {
      updatePopupPosition()
    })

    // Also update on view changes
    const updateInterval = setInterval(updatePopupPosition, 100)

    return () => {
      watchHandle.remove()
      animationHandle.remove()
      clearInterval(updateInterval)
    }
  }, [viewRef])

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
      <LayerListWidget />
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
