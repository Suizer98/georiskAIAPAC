import { useEffect, useRef } from 'react'
import {
  Cartesian3,
  Color,
  CustomDataSource,
  HeightReference,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
} from 'cesium'
import type { RiskItem } from '../../store/riskStore'
import { riskColor } from './riskColor'
import type { MapPopupSelection } from './MapPopup'

type HeatmapEntry = {
  entity: ReturnType<CustomDataSource['entities']['add']>
  baseColor: Color
  phase: number
}

export const useRiskLayer = (
  viewerRef: React.RefObject<Viewer | null>,
  riskData: RiskItem[],
  enabled: boolean,
  onSelect: (data: MapPopupSelection | null) => void
) => {
  const animationRef = useRef<number | null>(null)
  const dataSourceRef = useRef<CustomDataSource | null>(null)
  const heatmapRef = useRef<HeatmapEntry[]>([])
  const clickHandlerRef = useRef<ScreenSpaceEventHandler | null>(null)

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || dataSourceRef.current) {
      return
    }

    const dataSource = new CustomDataSource('risk-points')
    viewer.dataSources.add(dataSource)
    dataSourceRef.current = dataSource

    clickHandlerRef.current = new ScreenSpaceEventHandler(viewer.scene.canvas)
    clickHandlerRef.current.setInputAction((click: any) => {
      const picked = viewer.scene.pick(click.position)
      const entity = picked?.id

      if (entity && dataSource.entities.contains(entity)) {
        const item = entity.properties.item.getValue()
        const rect = viewer.scene.canvas.getBoundingClientRect()
        onSelect({
          x: rect.left + click.position.x,
          y: rect.top + click.position.y,
          payload: { type: 'risk', item },
        })
      }
    }, ScreenSpaceEventType.LEFT_CLICK)

    const animate = () => {
      const time = performance.now() / 1000
      heatmapRef.current.forEach(({ entity, baseColor, phase }) => {
        const alpha = 0.2 + 0.6 * (1 + Math.sin(time * 2 + phase)) / 2
        if (entity.point) {
          entity.point.color = baseColor.withAlpha(alpha)
        }
        if (entity.ellipse) {
          entity.ellipse.material = baseColor.withAlpha(alpha * 0.7)
          entity.ellipse.outlineColor = baseColor.withAlpha(
            Math.min(1, alpha + 0.2)
          )
        }
      })
      animationRef.current = requestAnimationFrame(animate)
    }
    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (clickHandlerRef.current) {
        clickHandlerRef.current.destroy()
        clickHandlerRef.current = null
      }
      const currentViewer = viewerRef.current
      if (currentViewer && !currentViewer.isDestroyed()) {
        currentViewer.dataSources.remove(dataSource, true)
      }
      dataSourceRef.current = null
      heatmapRef.current = []
    }
  }, [viewerRef, onSelect])

  useEffect(() => {
    const dataSource = dataSourceRef.current
    if (!dataSource) {
      return
    }

    dataSource.show = enabled
    dataSource.entities.removeAll()
    heatmapRef.current = []

    if (!enabled) {
      return
    }

    riskData.forEach((item) => {
      if (
        typeof item?.latitude !== 'number' ||
        typeof item?.longitude !== 'number'
      ) {
        return
      }
      const risk = Number(item?.risk_level ?? 0)
      const baseColor = riskColor(risk)
      const radius = 120000 + (Math.min(risk, 100) / 100) * 220000
      const entity = dataSource.entities.add({
        position: Cartesian3.fromDegrees(item.longitude, item.latitude),
        point: {
          pixelSize: 24 + Math.round((Math.min(risk, 100) / 100) * 22),
          heightReference: HeightReference.NONE,
          color: baseColor.withAlpha(0.95),
          outlineColor: Color.BLACK.withAlpha(0.4),
          outlineWidth: 3,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        ellipse: {
          semiMajorAxis: radius,
          semiMinorAxis: radius,
          height: 0,
          heightReference: HeightReference.NONE,
          material: baseColor.withAlpha(0.45),
          outline: true,
          outlineColor: baseColor.withAlpha(0.9),
        },
        label: {
          text: `${Math.round(risk)}`,
          font: '12px sans-serif',
          show: false,
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          pixelOffset: new Cartesian3(0, -24, 0),
          heightReference: HeightReference.NONE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: { item },
      })
      heatmapRef.current.push({
        entity,
        baseColor,
        phase: Math.random() * Math.PI * 2,
      })
    })
    viewerRef.current?.scene.requestRender()
  }, [riskData, enabled, viewerRef])
}
