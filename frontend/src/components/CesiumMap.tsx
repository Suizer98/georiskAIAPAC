import { type CSSProperties, useEffect, useRef } from 'react'
import {
  Cartesian3,
  Color,
  CustomDataSource,
  HeightReference,
  Ion,
  SceneMode,
  Viewer,
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { useRiskStore } from '../store/riskStore'
import { useLayerStore } from '../store/layerStore'

const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined

type CesiumMapProps = {
  className?: string
  style?: CSSProperties
}

export default function CesiumMap({ className, style }: CesiumMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const animationRef = useRef<number | null>(null)
  const dataSourceRef = useRef<CustomDataSource | null>(null)
  const heatmapRef = useRef<
    Array<{ entity: ReturnType<CustomDataSource['entities']['add']>; baseColor: Color; phase: number }>
  >([])
  const riskData = useRiskStore((state) => state.data)
  const fetchRisk = useRiskStore((state) => state.fetchRisk)
  const riskLayerEnabled = useLayerStore(
    (state) => state.layers.find((layer) => layer.id === 'risk')?.enabled ?? true
  )

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    if (ionToken) {
      Ion.defaultAccessToken = ionToken
    }

    const viewer = new Viewer(containerRef.current, {
      animation: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      timeline: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      sceneMode: SceneMode.SCENE2D,
    })

    viewer.scene.globe.enableLighting = true
    viewer.scene.globe.depthTestAgainstTerrain = false
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(120, 15, 25000000),
    })
    viewerRef.current = viewer

    const dataSource = new CustomDataSource('risk-points')
    dataSourceRef.current = dataSource
    heatmapRef.current = []

    viewer.dataSources.add(dataSource)
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

    const controller = new AbortController()
    fetchRisk(controller.signal)

    return () => {
      controller.abort()
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      viewer.destroy()
      viewerRef.current = null
      dataSourceRef.current = null
      heatmapRef.current = []
    }
  }, [])

  useEffect(() => {
    const dataSource = dataSourceRef.current
    if (!dataSource) {
      return
    }
    dataSource.show = riskLayerEnabled
    dataSource.entities.removeAll()
    heatmapRef.current = []

    if (!riskLayerEnabled) {
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
      const baseColor = (() => {
        const clamped = Math.max(0, Math.min(100, risk))
        const t = clamped / 100
        const low = Color.fromCssColorString('#22c55e')
        const mid = Color.fromCssColorString('#f59e0b')
        const high = Color.fromCssColorString('#ef4444')
        if (t < 0.5) {
          return Color.lerp(low, mid, t * 2, new Color())
        }
        return Color.lerp(mid, high, (t - 0.5) * 2, new Color())
      })()

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
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          pixelOffset: new Cartesian3(0, -24, 0),
          heightReference: HeightReference.NONE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      })
      heatmapRef.current.push({
        entity,
        baseColor,
        phase: Math.random() * Math.PI * 2,
      })
    })
    viewerRef.current?.scene.requestRender()
  }, [riskData, riskLayerEnabled])

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
