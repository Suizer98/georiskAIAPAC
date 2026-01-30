import { useEffect, useRef } from 'react'
import MapView from '@arcgis/core/views/MapView'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import Graphic from '@arcgis/core/Graphic'
import Point from '@arcgis/core/geometry/Point'
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol'
import type { RiskItem } from '../../store/riskStore'
import { riskColor } from './riskColor'
import type { MapPopupSelection } from './MapPopup'

type HeatmapEntry = {
  graphic: Graphic
  baseColor: string
  phase: number
}

export const useArcGISRiskLayer = (
  viewRef: React.RefObject<MapView | null>,
  riskData: RiskItem[],
  enabled: boolean,
  onSelect: (data: MapPopupSelection | null) => void
) => {
  const animationRef = useRef<number | null>(null)
  const graphicsLayerRef = useRef<GraphicsLayer | null>(null)

  useEffect(() => {
    if (graphicsLayerRef.current) {
      graphicsLayerRef.current.title = 'City'
    }
  }, [])
  const heatmapRef = useRef<HeatmapEntry[]>([])
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

    // Animation loop for pulsing effect
    const animate = () => {
      const time = performance.now() / 1000
      heatmapRef.current.forEach(({ graphic, baseColor, phase }) => {
        const alpha = 0.2 + (0.6 * (1 + Math.sin(time * 2 + phase))) / 2
        const rgb = hexToRgb(baseColor)
        const color = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`

        // Update point symbol
        if (graphic.symbol instanceof SimpleMarkerSymbol) {
          graphic.symbol = new SimpleMarkerSymbol({
            style: 'circle',
            color: color,
            size: graphic.symbol.size,
            outline: {
              color: 'rgba(0, 0, 0, 0.4)',
              width: 3,
            },
          })
        }
      })
      animationRef.current = requestAnimationFrame(animate)
    }
    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
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
      heatmapRef.current = []
    }
  }, [viewRef, onSelect])

  useEffect(() => {
    const graphicsLayer = graphicsLayerRef.current
    if (!graphicsLayer) {
      return
    }

    graphicsLayer.visible = enabled
    graphicsLayer.removeAll()
    heatmapRef.current = []

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
      const pointSize = 40 + Math.round((Math.min(risk, 100) / 100) * 30) // Increased from 24-46 to 40-70

      // Create point
      const point = new Point({
        longitude: item.longitude,
        latitude: item.latitude,
      })

      // Create point symbol
      const pointSymbol = new SimpleMarkerSymbol({
        style: 'circle',
        color: hexToRgba(baseColor, 0.95),
        size: pointSize,
        outline: {
          color: 'rgba(0, 0, 0, 0.4)',
          width: 3,
        },
      })

      // Create label graphic (initially hidden)
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

      // Create main point graphic
      const pointGraphic = new Graphic({
        geometry: point,
        symbol: pointSymbol,
        attributes: {
          item,
          labelGraphic,
        },
      })

      // Add all graphics to layer
      graphicsLayer.addMany([pointGraphic, labelGraphic])

      heatmapRef.current.push({
        graphic: pointGraphic,
        baseColor,
        phase: Math.random() * Math.PI * 2,
      })
    })
  }, [riskData, enabled, viewRef])
}

// Helper functions
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
