import { useEffect, useRef, useState } from 'react'
import MapView from '@arcgis/core/views/MapView'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import Graphic from '@arcgis/core/Graphic'
import Point from '@arcgis/core/geometry/Point'
import PictureMarkerSymbol from '@arcgis/core/symbols/PictureMarkerSymbol'
import type { RadarStateItem } from '../../store/radarStore'
import type { MapPopupSelection } from './MapPopup'

const PLANE_ICON_URL = '/plane.png'
const PLANE_COLOR = '#38bdf8'
const PLANE_SIZE = 20

function tintPlanePng(url: string, color: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const ctx = document.createElement('canvas').getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas 2d'))
        return
      }
      const w = img.width
      const h = img.height
      ctx.canvas.width = w
      ctx.canvas.height = h
      ctx.drawImage(img, 0, 0)
      ctx.globalCompositeOperation = 'source-in'
      ctx.fillStyle = color
      ctx.fillRect(0, 0, w, h)
      resolve(ctx.canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('Load plane.png'))
    img.src = url
  })
}

function isValid(item: RadarStateItem): boolean {
  return (
    typeof item?.latitude === 'number' && typeof item?.longitude === 'number'
  )
}

// Plane PNG is nose-down (default = south). ArcGIS: 0 = east, 90 = north (CCW). So angle = 270 - true_track.
function symbolAngle(trueTrack: number | null): number {
  if (trueTrack == null) return 270
  return 270 - trueTrack
}

export const useArcGISRadarLayer = (
  viewRef: React.RefObject<MapView | null>,
  data: RadarStateItem[],
  enabled: boolean,
  onSelect: (data: MapPopupSelection | null) => void
) => {
  const layerRef = useRef<GraphicsLayer | null>(null)
  const clickHandlerRef = useRef<ReturnType<MapView['on']> | null>(null)
  const [tintedUrl, setTintedUrl] = useState<string | null>(null)

  useEffect(() => {
    tintPlanePng(PLANE_ICON_URL, PLANE_COLOR).then(setTintedUrl)
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view || layerRef.current) return

    const layer = new GraphicsLayer({ title: 'Flights' })
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
          const attrs = result.graphic.attributes as Partial<RadarStateItem>
          const lat = attrs?.latitude
          const lng = attrs?.longitude
          if (typeof lat !== 'number' || typeof lng !== 'number') return
          const screenPoint = view.toScreen(event.mapPoint)
          const rect = view.container.getBoundingClientRect()
          onSelect({
            x: rect.left + (screenPoint?.x ?? 0),
            y: rect.top + (screenPoint?.y ?? 0),
            position: event.mapPoint,
            payload: {
              type: 'radar',
              item: {
                icao24: attrs.icao24 ?? null,
                callsign: attrs.callsign ?? null,
                latitude: lat,
                longitude: lng,
                baro_altitude: attrs.baro_altitude ?? null,
                true_track: attrs.true_track ?? null,
              },
            },
          })
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

    const iconUrl = tintedUrl ?? PLANE_ICON_URL
    for (const item of data.filter(isValid)) {
      const point = new Point({
        longitude: item.longitude,
        latitude: item.latitude,
        spatialReference: view.spatialReference,
      })
      const symbol = new PictureMarkerSymbol({
        url: iconUrl,
        width: PLANE_SIZE,
        height: PLANE_SIZE,
        angle: symbolAngle(item.true_track),
      })
      layer.graphics.add(
        new Graphic({
          geometry: point,
          symbol,
          attributes: {
            icao24: item.icao24,
            callsign: item.callsign,
            latitude: item.latitude,
            longitude: item.longitude,
            baro_altitude: item.baro_altitude,
            true_track: item.true_track,
          },
        })
      )
    }
  }, [data, enabled, viewRef, tintedUrl])
}
