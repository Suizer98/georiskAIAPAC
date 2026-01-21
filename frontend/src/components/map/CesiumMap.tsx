import { type CSSProperties, useEffect, useRef } from 'react'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { useRiskStore } from '../../store/riskStore'
import { useLayerStore } from '../../store/layerStore'
import { useCesiumViewer } from './useCesiumViewer'
import { useRiskLayer } from './useRiskLayer'

type CesiumMapProps = {
  className?: string
  style?: CSSProperties
}

export default function CesiumMap({ className, style }: CesiumMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewerRef = useCesiumViewer(containerRef)
  const riskData = useRiskStore((state) => state.data)
  const fetchRisk = useRiskStore((state) => state.fetchRisk)
  const riskLayerEnabled = useLayerStore(
    (state) => state.layers.find((layer) => layer.id === 'risk')?.enabled ?? true
  )

  useRiskLayer(viewerRef, riskData, riskLayerEnabled)

  useEffect(() => {
    const controller = new AbortController()
    fetchRisk(controller.signal)
    return () => controller.abort()
  }, [fetchRisk])

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
