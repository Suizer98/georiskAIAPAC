import { useEffect, useRef } from 'react'
import MapView from '@arcgis/core/views/MapView'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import Graphic from '@arcgis/core/Graphic'
import Point from '@arcgis/core/geometry/Point'
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol'
import type { GdeltHotspot } from '../../store/gdeltStore'
import type { MapPopupSelection } from './MapPopup'

const GDELT_RGB = [180, 100, 90] as const

function isValid(item: GdeltHotspot): boolean {
  return (
    typeof item?.latitude === 'number' && typeof item?.longitude === 'number'
  )
}

const MIN_DOT_SIZE = 8
const MAX_DOT_SIZE = 24
const PULSE_PERIOD_MS = 2500
const OPACITY_MIN = 0.35
const OPACITY_MAX = 0.88

function pointSymbolForMentions(
  mentions: number,
  opacity: number = 0.88
): SimpleMarkerSymbol {
  const count = Math.max(1, mentions)
  const size = Math.min(
    MAX_DOT_SIZE,
    Math.max(MIN_DOT_SIZE, MIN_DOT_SIZE + Math.log2(count) * 3)
  )
  return new SimpleMarkerSymbol({
    style: 'circle',
    color: `rgba(${GDELT_RGB[0]}, ${GDELT_RGB[1]}, ${GDELT_RGB[2]}, ${opacity})`,
    size,
    outline: {
      color: 'rgba(0, 0, 0, 0.4)',
      width: 2,
    },
  })
}

export const useArcGISGdeltLayer = (
  viewRef: React.RefObject<MapView | null>,
  data: GdeltHotspot[],
  enabled: boolean,
  query: string,
  onSelect: (data: MapPopupSelection | null) => void
) => {
  const layerRef = useRef<GraphicsLayer | null>(null)
  const clickHandlerRef = useRef<ReturnType<MapView['on']> | null>(null)

  useEffect(() => {
    const view = viewRef.current
    if (!view || layerRef.current) {
      return
    }

    const layer = new GraphicsLayer({
      title: 'GDELT Hotspots',
    })
    view.map.add(layer)
    layerRef.current = layer

    clickHandlerRef.current = view.on('click', (event) => {
      if (view.destroyed) return
      const currentLayer = layerRef.current
      if (!currentLayer) return
      view
        .hitTest(event)
        .then((response) => {
          if (view.destroyed) return
          const result = response.results.find(
            (r) => r.graphic?.layer === currentLayer
          )
          if (!result?.graphic) return
          const graphic = result.graphic
          const attrs = graphic.attributes as {
            latitude?: number
            longitude?: number
            count?: number
          }
          const lat = attrs?.latitude
          const lng = attrs?.longitude
          const count = attrs?.count ?? 1
          if (typeof lat === 'number' && typeof lng === 'number') {
            const screenPoint = view.toScreen(event.mapPoint)
            const rect = view.container.getBoundingClientRect()
            onSelect({
              x: rect.left + (screenPoint?.x ?? 0),
              y: rect.top + (screenPoint?.y ?? 0),
              position: event.mapPoint,
              payload: {
                type: 'gdelt',
                item: { latitude: lat, longitude: lng, count },
                query,
              },
            })
          }
        })
        .catch(() => {})
    })

    return () => {
      if (clickHandlerRef.current) {
        clickHandlerRef.current.remove()
        clickHandlerRef.current = null
      }
      const currentView = viewRef.current
      if (currentView && !currentView.destroyed && layerRef.current) {
        try {
          currentView.map.remove(layerRef.current)
        } catch {
          // ignore
        }
      }
      layerRef.current = null
    }
  }, [viewRef, onSelect])

  useEffect(() => {
    const view = viewRef.current
    const layer = layerRef.current
    if (!view || !layer) return

    layer.graphics.removeAll()
    if (!enabled) return

    const items = data.filter(isValid)
    for (const item of items) {
      const point = new Point({
        longitude: item.longitude,
        latitude: item.latitude,
        spatialReference: view.spatialReference,
      })
      layer.graphics.add(
        new Graphic({
          geometry: point,
          symbol: pointSymbolForMentions(item.count ?? 1),
          attributes: {
            latitude: item.latitude,
            longitude: item.longitude,
            count: item.count ?? 1,
          },
        })
      )
    }

    const startTime = Date.now()
    let rafId: number

    const tick = () => {
      if (!layerRef.current) return
      const elapsed = Date.now() - startTime
      const t = (elapsed / PULSE_PERIOD_MS) * Math.PI * 2
      const opacity =
        OPACITY_MIN + (OPACITY_MAX - OPACITY_MIN) * (0.5 + 0.5 * Math.sin(t))
      const currentLayer = layerRef.current
      currentLayer.graphics.forEach((graphic) => {
        const count = (graphic.attributes?.count as number) ?? 1
        graphic.symbol = pointSymbolForMentions(count, opacity)
      })
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [data, enabled, viewRef])
}
