import { useEffect, useRef } from 'react'
import MapView from '@arcgis/core/views/MapView'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import Graphic from '@arcgis/core/Graphic'
import Point from '@arcgis/core/geometry/Point'
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol'
import type { PriceItem } from '../../store/priceStore'
import type { MapPopupSelection } from './MapPopup'

export const useArcGISPriceLayer = (
  viewRef: React.RefObject<MapView | null>,
  priceData: PriceItem[],
  enabled: boolean,
  onSelect: (data: MapPopupSelection | null) => void
) => {
  const graphicsLayerRef = useRef<GraphicsLayer | null>(null)
  const hoverRef = useRef<Graphic | null>(null)
  const hoverHandlerRef = useRef<any>(null)
  const clickHandlerRef = useRef<any>(null)

  useEffect(() => {
    const view = viewRef.current
    if (!view) {
      return
    }

    // Create graphics layer
    const graphicsLayer = new GraphicsLayer({
      title: 'Metals Price',
    })
    view.map.add(graphicsLayer)
    // Move price layer to top so it's clickable above other layers
    view.map.reorder(graphicsLayer, view.map.layers.length - 1)
    graphicsLayerRef.current = graphicsLayer

    // Setup hover handler
    hoverHandlerRef.current = view.on('pointer-move', (event) => {
      if (view.destroyed || !enabled) return
      view.hitTest(event).then((response) => {
        if (view.destroyed || !enabled) return
        const graphic = response.results.find(
          (result) => result.graphic?.layer === graphicsLayer
        )?.graphic as Graphic | undefined

        // Reset previous hover
        if (hoverRef.current && hoverRef.current !== graphic) {
          if (hoverRef.current.symbol instanceof SimpleMarkerSymbol) {
            hoverRef.current.symbol = new SimpleMarkerSymbol({
              style: 'circle',
              color: 'rgba(212, 175, 55, 0.8)', // GOLD
              size: 12,
              outline: {
                color: 'black',
                width: 2,
              },
            })
          }
          if (hoverRef.current.attributes?.labelGraphic) {
            hoverRef.current.attributes.labelGraphic.visible = false
          }
          hoverRef.current = null
        }

        // Highlight current hover
        if (graphic && graphic.symbol instanceof SimpleMarkerSymbol) {
          graphic.symbol = new SimpleMarkerSymbol({
            style: 'circle',
            color: 'white',
            size: 16,
            outline: {
              color: 'black',
              width: 2,
            },
          })
          if (graphic.attributes?.labelGraphic) {
            graphic.attributes.labelGraphic.visible = true
          }
          hoverRef.current = graphic
        }
      }).catch(() => {
        // Ignore hitTest errors
      })
    })

    // Setup click handler
    clickHandlerRef.current = view.on('click', (event) => {
      if (view.destroyed || !enabled) return
      view.hitTest(event).then((response) => {
        if (view.destroyed || !enabled) return
        const graphic = response.results.find(
          (result) => result.graphic?.layer === graphicsLayer
        )?.graphic as Graphic | undefined

        if (graphic) {
          const item = graphic.attributes.item as PriceItem
          const screenPoint = view.toScreen(event.mapPoint)
          const rect = view.container.getBoundingClientRect()
          onSelect({
            x: rect.left + screenPoint.x,
            y: rect.top + screenPoint.y,
            position: event.mapPoint,
            payload: { type: 'price', item },
          })
        }
      }).catch(() => {
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
  }, [viewRef, onSelect, enabled])

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

    priceData.forEach((item) => {
      if (
        typeof item.latitude !== 'number' ||
        typeof item.longitude !== 'number'
      ) {
        return
      }

      const goldUsd =
        typeof item.gold_usd === 'number'
          ? `$${item.gold_usd.toFixed(2)}`
          : 'N/A'
      const silverUsd =
        typeof item.silver_usd === 'number'
          ? `$${item.silver_usd.toFixed(2)}`
          : 'N/A'
      const localCode = item.currency ?? 'LOCAL'
      const goldLocal =
        typeof item.gold_local === 'number'
          ? `${localCode} ${item.gold_local.toFixed(2)}`
          : 'N/A'
      const silverLocal =
        typeof item.silver_local === 'number'
          ? `${localCode} ${item.silver_local.toFixed(2)}`
          : 'N/A'

      // Create point
      const point = new Point({
        longitude: item.longitude,
        latitude: item.latitude,
      })

      // Create point symbol
      const pointSymbol = new SimpleMarkerSymbol({
        style: 'circle',
        color: 'rgba(212, 175, 55, 0.8)', // GOLD
        size: 12,
        outline: {
          color: 'black',
          width: 2,
        },
      })

      // Create label graphic (initially hidden)
      const labelPoint = new Point({
        longitude: item.longitude,
        latitude: item.latitude,
      })

      const labelGraphic = new Graphic({
        geometry: labelPoint,
        symbol: {
          type: 'text',
          text: item.country,
          color: 'white',
          font: {
            size: 14,
            family: 'sans-serif',
          },
          haloColor: 'black',
          haloSize: 3,
          yoffset: -15,
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

      // Add graphics to layer
      graphicsLayer.addMany([pointGraphic, labelGraphic])
    })
  }, [priceData, enabled])
}
