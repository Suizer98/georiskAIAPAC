import { useEffect, useRef } from 'react'
import MapView from '@arcgis/core/views/MapView'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import Graphic from '@arcgis/core/Graphic'
import Point from '@arcgis/core/geometry/Point'
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol'
import type { RiskItem } from '../../store/riskStore'
import { riskColor } from './riskColor'
import type { MapPopupSelection } from './MapPopup'

export const useArcGISRiskLayer = (
  viewRef: React.RefObject<MapView | null>,
  riskData: RiskItem[],
  enabled: boolean,
  onSelect: (data: MapPopupSelection | null) => void
) => {
  const graphicsLayerRef = useRef<GraphicsLayer | null>(null)
  const clickHandlerRef = useRef<any>(null)
  const hoverHandlerRef = useRef<any>(null)
  const hoverRef = useRef<Graphic | null>(null)

  useEffect(() => {
    const view = viewRef.current
    if (!view || graphicsLayerRef.current) {
      return
    }

    const graphicsLayer = new GraphicsLayer({
      title: 'City',
    })
    view.map.add(graphicsLayer)
    graphicsLayerRef.current = graphicsLayer

    // Setup hover handler
    hoverHandlerRef.current = view.on('pointer-move', (event) => {
      if (view.destroyed) return
      view
        .hitTest(event)
        .then((response) => {
          if (view.destroyed) return
          const graphic = response.results.find(
            (result) => result.graphic?.layer === graphicsLayer
          )?.graphic as Graphic | undefined

          if (hoverRef.current && hoverRef.current !== graphic) {
            const attributes = hoverRef.current.attributes
            if (attributes?.labelGraphic) {
              attributes.labelGraphic.visible = false
            }
            hoverRef.current = null
          }

          if (graphic && graphic.attributes?.labelGraphic) {
            graphic.attributes.labelGraphic.visible = true
            hoverRef.current = graphic
          }
        })
        .catch(() => {
          // Ignore hitTest errors
        })
    })

    // Setup click handler
    clickHandlerRef.current = view.on('click', (event) => {
      if (view.destroyed) return
      view
        .hitTest(event)
        .then((response) => {
          if (view.destroyed) return

          // Check for higher-priority layers first (JP Morgan, Price, etc.)
          // These should take precedence over risk heatmap
          const priorityLayers = response.results.find((result) => {
            const layer = result.graphic?.layer
            if (!layer) return false
            const layerTitle = (layer as any).title
            // Skip if it's a higher-priority point layer
            return (
              layerTitle === 'JP Morgan Offices' ||
              layerTitle === 'Metals Price'
            )
          })

          // If a higher-priority layer was clicked, don't process risk click
          if (priorityLayers) {
            return
          }

          const graphic = response.results.find(
            (result) => result.graphic?.layer === graphicsLayer
          )?.graphic as Graphic | undefined

          if (graphic) {
            const item = graphic.attributes.item as RiskItem
            const screenPoint = view.toScreen(event.mapPoint)
            const rect = view.container.getBoundingClientRect()
            onSelect({
              x: rect.left + screenPoint.x,
              y: rect.top + screenPoint.y,
              position: event.mapPoint,
              payload: { type: 'risk', item },
            })
          }
        })
        .catch(() => {
          // Ignore hitTest errors
        })
    })

    return () => {
      if (hoverHandlerRef.current) {
        hoverHandlerRef.current.remove()
        hoverHandlerRef.current = null
      }
      if (clickHandlerRef.current) {
        clickHandlerRef.current.remove()
        clickHandlerRef.current = null
      }
      hoverRef.current = null
      const currentView = viewRef.current
      if (currentView && !currentView.destroyed && graphicsLayerRef.current) {
        try {
          currentView.map.remove(graphicsLayerRef.current)
        } catch (error) {
          // Map might already be destroyed
          console.warn('Failed to remove graphics layer:', error)
        }
      }
      graphicsLayerRef.current = null
    }
  }, [viewRef, onSelect])

  useEffect(() => {
    const graphicsLayer = graphicsLayerRef.current
    if (!graphicsLayer) {
      return
    }

    graphicsLayer.visible = enabled
    graphicsLayer.removeAll()

    if (!enabled) {
      return
    }

    const view = viewRef.current
    if (!view) {
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
      const pointSize = 40 + Math.round((Math.min(risk, 100) / 100) * 30)

      const point = new Point({
        longitude: item.longitude,
        latitude: item.latitude,
      })

      const pointSymbol = new SimpleMarkerSymbol({
        style: 'circle',
        color: hexToRgba(baseColor, 0.95),
        size: pointSize,
        outline: {
          color: 'rgba(0, 0, 0, 0.4)',
          width: 3,
        },
      })

      const labelText = item.city ?? item.country ?? `${Math.round(risk)}`
      const labelPoint = new Point({
        longitude: item.longitude,
        latitude: item.latitude,
      })

      const labelGraphic = new Graphic({
        geometry: labelPoint,
        symbol: {
          type: 'text',
          text: labelText,
          color: 'white',
          font: {
            size: 12,
            family: 'sans-serif',
          },
          haloColor: 'black',
          haloSize: 3,
          yoffset: -24,
        } as any,
        visible: false,
      })

      const pointGraphic = new Graphic({
        geometry: point,
        symbol: pointSymbol,
        attributes: {
          item,
          labelGraphic,
        },
      })

      graphicsLayer.addMany([pointGraphic, labelGraphic])
    })
  }, [riskData, enabled, viewRef])
}

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [0, 0, 0]
}

const hexToRgba = (hex: string, alpha: number): string => {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
