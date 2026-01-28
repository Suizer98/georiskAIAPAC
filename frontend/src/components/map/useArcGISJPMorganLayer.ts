import { useEffect, useRef } from 'react'
import MapView from '@arcgis/core/views/MapView'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import Graphic from '@arcgis/core/Graphic'
import Point from '@arcgis/core/geometry/Point'
import SimpleMarkerSymbol from '@arcgis/core/symbols/SimpleMarkerSymbol'
import type { JPMorganOffice } from '../../store/jpmorganStore'
import type { MapPopupSelection } from './MapPopup'

export const useArcGISJPMorganLayer = (
  viewRef: React.RefObject<MapView | null>,
  officeData: JPMorganOffice[],
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

    const graphicsLayer = new GraphicsLayer({
      title: 'JP Morgan Offices',
    })
    view.map.add(graphicsLayer)
    // Move JP Morgan layer to top so it's clickable above other layers
    view.map.reorder(graphicsLayer, view.map.layers.length - 1)
    graphicsLayerRef.current = graphicsLayer

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
            if (hoverRef.current.symbol instanceof SimpleMarkerSymbol) {
              hoverRef.current.symbol = new SimpleMarkerSymbol({
                style: 'circle',
                color: 'rgba(0, 102, 204, 0.8)', // JP Morgan blue
                size: 14,
                outline: {
                  color: 'white',
                  width: 2,
                },
              })
            }
            if (hoverRef.current.attributes?.labelGraphic) {
              hoverRef.current.attributes.labelGraphic.visible = false
            }
            hoverRef.current = null
          }

          if (graphic && graphic.symbol instanceof SimpleMarkerSymbol) {
            graphic.symbol = new SimpleMarkerSymbol({
              style: 'circle',
              color: 'rgba(0, 102, 204, 1)', // Brighter blue on hover
              size: 18,
              outline: {
                color: 'white',
                width: 3,
              },
            })
            if (graphic.attributes?.labelGraphic) {
              graphic.attributes.labelGraphic.visible = true
            }
            hoverRef.current = graphic
          }
        })
        .catch(() => {})
    })

    clickHandlerRef.current = view.on('click', (event) => {
      if (view.destroyed) return
      view
        .hitTest(event)
        .then((response) => {
          if (view.destroyed) return
          const graphic = response.results.find(
            (result) => result.graphic?.layer === graphicsLayer
          )?.graphic as Graphic | undefined

          if (graphic) {
            const office = graphic.attributes.office as JPMorganOffice
            const screenPoint = view.toScreen(event.mapPoint)
            const rect = view.container.getBoundingClientRect()
            onSelect({
              x: rect.left + screenPoint.x,
              y: rect.top + screenPoint.y,
              position: event.mapPoint,
              payload: { type: 'jpmorgan', office },
            })
          }
        })
        .catch(() => {})
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

    officeData.forEach((office) => {
      if (
        typeof office.latitude !== 'number' ||
        typeof office.longitude !== 'number'
      ) {
        return
      }

      const point = new Point({
        longitude: office.longitude,
        latitude: office.latitude,
      })

      const pointSymbol = new SimpleMarkerSymbol({
        style: 'circle',
        color: 'rgba(0, 102, 204, 0.8)', // JP Morgan blue
        size: 14,
        outline: {
          color: 'white',
          width: 2,
        },
      })

      const labelPoint = new Point({
        longitude: office.longitude,
        latitude: office.latitude,
      })

      const labelGraphic = new Graphic({
        geometry: labelPoint,
        symbol: {
          type: 'text',
          text: office.city,
          color: 'white',
          font: {
            size: 12,
            family: 'sans-serif',
            weight: 'bold',
          },
          haloColor: 'rgba(0, 102, 204, 0.8)',
          haloSize: 3,
          yoffset: -18,
        } as any,
        visible: false,
      })

      const pointGraphic = new Graphic({
        geometry: point,
        symbol: pointSymbol,
        attributes: {
          office,
          labelGraphic,
        },
      })

      graphicsLayer.addMany([pointGraphic, labelGraphic])
    })
  }, [officeData, enabled])
}
