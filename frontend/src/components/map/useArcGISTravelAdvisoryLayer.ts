import { useEffect, useRef } from 'react'
import MapView from '@arcgis/core/views/MapView'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import Graphic from '@arcgis/core/Graphic'
import Polygon from '@arcgis/core/geometry/Polygon'
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol'
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol'
import type { TravelAdvisoryItem } from '../../store/travelAdvisoryStore'
import { APAC_ISO2_CODES } from '../../store/travelAdvisoryStore'
import type { MapPopupSelection } from './MapPopup'

const LEVEL_COLORS: Record<number, string> = {
  1: '#22c55e',
  2: '#eab308',
  3: '#f97316',
  4: '#ef4444',
}

const getLevelColor = (level: number | null): string => {
  if (level === null || level < 1 || level > 4) {
    return '#6b7280'
  }
  return LEVEL_COLORS[level] ?? '#6b7280'
}

export const useArcGISTravelAdvisoryLayer = (
  viewRef: React.RefObject<MapView | null>,
  travelAdvisoryData: TravelAdvisoryItem[],
  enabled: boolean,
  onSelect?: (data: MapPopupSelection | null) => void
) => {
  const graphicsLayerRef = useRef<GraphicsLayer | null>(null)
  const countryGraphicsRef = useRef<Map<string, Graphic>>(new Map())
  const hoverHandlerRef = useRef<any>(null)
  const clickHandlerRef = useRef<any>(null)
  const hoverRef = useRef<Graphic | null>(null)

  useEffect(() => {
    if (graphicsLayerRef.current) {
      graphicsLayerRef.current.title = 'Travel Advisory Levels'
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view || graphicsLayerRef.current) {
      return
    }

    const graphicsLayer = new GraphicsLayer({
      title: 'Travel Advisory Levels',
      opacity: 0.7,
    })
    view.map.add(graphicsLayer)
    view.map.reorder(graphicsLayer, 0)
    graphicsLayerRef.current = graphicsLayer

    if (onSelect) {
      hoverHandlerRef.current = view.on('pointer-move', (event: any) => {
        if (view.destroyed) return
        view
          .hitTest(event)
          .then((response: any) => {
            if (view.destroyed) return
            const graphic = response.results.find(
              (result: any) => result.graphic?.layer === graphicsLayer
            )?.graphic as Graphic | undefined

            if (graphic && graphic !== hoverRef.current) {
              const item = graphic.attributes?.item as
                | TravelAdvisoryItem
                | undefined
              if (item) {
                const screenPoint = view.toScreen(event.mapPoint)
                const rect = view.container.getBoundingClientRect()
                onSelect({
                  x: rect.left + screenPoint.x,
                  y: rect.top + screenPoint.y,
                  position: event.mapPoint,
                  payload: { type: 'travel_advisory', item },
                })
                hoverRef.current = graphic
              }
            } else if (!graphic && hoverRef.current) {
              onSelect(null)
              hoverRef.current = null
            }
          })
          .catch(() => {})
      })

      clickHandlerRef.current = view.on('click', (event: any) => {
        if (view.destroyed) return
        view
          .hitTest(event)
          .then((response: any) => {
            if (view.destroyed) return
            const graphic = response.results.find(
              (result: any) => result.graphic?.layer === graphicsLayer
            )?.graphic as Graphic | undefined

            if (graphic) {
              const item = graphic.attributes.item as
                | TravelAdvisoryItem
                | undefined
              if (item) {
                const screenPoint = view.toScreen(event.mapPoint)
                const rect = view.container.getBoundingClientRect()
                onSelect({
                  x: rect.left + screenPoint.x,
                  y: rect.top + screenPoint.y,
                  position: event.mapPoint,
                  payload: { type: 'travel_advisory', item },
                })
              }
            }
          })
          .catch(() => {})
      })
    }

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
        } catch {}
      }
      graphicsLayerRef.current = null
      countryGraphicsRef.current.clear()
      hoverRef.current = null
    }
  }, [viewRef, onSelect])

  useEffect(() => {
    const graphicsLayer = graphicsLayerRef.current
    if (!graphicsLayer) {
      return
    }

    graphicsLayer.visible = enabled

    if (!enabled) {
      graphicsLayer.removeAll()
      countryGraphicsRef.current.clear()
      return
    }

    const loadCountryBoundaries = async () => {
      graphicsLayer.removeAll()
      countryGraphicsRef.current.clear()

      /** Look up travel advisory by ISO2 (backend returns country_code=iso2). */
      const advisoryByIso2 = new Map<string, TravelAdvisoryItem>()
      for (const item of travelAdvisoryData) {
        if (item.country) {
          advisoryByIso2.set(item.country.toUpperCase().trim(), item)
        }
      }

      const findAdvisory = (iso2: string): TravelAdvisoryItem | null => {
        const key = iso2.toUpperCase().trim()
        return advisoryByIso2.get(key) ?? null
      }

      let successCount = 0
      let errorCount = 0

      const worldGeoJsonUrl =
        'https://cdn.jsdelivr.net/gh/datasets/geo-countries@main/data/countries.geojson'

      let worldGeoJson: any = null
      try {
        const worldResponse = await fetch(worldGeoJsonUrl)
        if (!worldResponse.ok) return
        worldGeoJson = await worldResponse.json()
      } catch {
        return
      }

      if (
        !worldGeoJson ||
        worldGeoJson.type !== 'FeatureCollection' ||
        !Array.isArray(worldGeoJson.features)
      ) {
        return
      }

      /** GeoJSON (geo-countries) uses ISO3166-1-Alpha-2 / iso_a2; match by ISO2 only. */
      const matchByIso2 = (feature: any, iso2: string): boolean => {
        const id = feature.id
        if (
          id === iso2 ||
          (typeof id === 'string' && id.toUpperCase() === iso2)
        ) {
          return true
        }
        const props = feature.properties || {}
        const propIso2 =
          props.iso_a2 ??
          props.ISO_A2 ??
          props.ISO2 ??
          props.iso2 ??
          props.ISO_A2_EH ??
          props['ISO3166-1-Alpha-2'] ??
          props['iso3166-1-alpha-2']
        return (
          propIso2 != null &&
          String(propIso2).toUpperCase() === iso2.toUpperCase()
        )
      }

      for (const iso2 of APAC_ISO2_CODES) {
        try {
          const countryFeature = worldGeoJson.features.find((feature: any) =>
            matchByIso2(feature, iso2)
          )

          if (!countryFeature) {
            errorCount++
            continue
          }

          const item: TravelAdvisoryItem =
            findAdvisory(iso2) ?? {
              country: iso2,
              level: null,
            }

          const countryGeoJson = {
            type: 'FeatureCollection',
            features: [countryFeature],
          }

          await renderCountryGeometry(countryGeoJson, item, graphicsLayer)
          successCount++
        } catch {
          errorCount++
        }
      }
    }

    if (enabled) {
      loadCountryBoundaries()
    }
  }, [travelAdvisoryData, enabled, viewRef])

  const renderCountryGeometry = async (
    geoJson: any,
    item: TravelAdvisoryItem,
    graphicsLayer: GraphicsLayer
  ) => {
    try {
      const level = item.level
      const color = getLevelColor(level)
      const alpha = level === null ? 0.1 : 0.4

      if (
        geoJson.type === 'FeatureCollection' &&
        Array.isArray(geoJson.features)
      ) {
        for (const feature of geoJson.features) {
          if (!feature.geometry) continue

          const geometry = feature.geometry
          if (geometry.type === 'Polygon') {
            const outerRing = geometry.coordinates[0].map((coord: number[]) => [
              coord[0],
              coord[1],
            ])
            const polygon = new Polygon({
              rings: [outerRing],
              spatialReference: { wkid: 4326 },
            })

            const symbol = new SimpleFillSymbol({
              color: hexToRgba(color, alpha),
              outline: new SimpleLineSymbol({
                color: hexToRgba(color, 0.8),
                width: 1,
              }),
            })

            const graphic = new Graphic({
              geometry: polygon,
              symbol,
              attributes: {
                country: item.country,
                level: level,
                item: item,
              },
            })

            graphicsLayer.add(graphic)
            countryGraphicsRef.current.set(item.country, graphic)
          } else if (geometry.type === 'MultiPolygon') {
            for (const polygonCoords of geometry.coordinates) {
              const outerRing = polygonCoords[0].map((coord: number[]) => [
                coord[0],
                coord[1],
              ])
              const polygon = new Polygon({
                rings: [outerRing],
                spatialReference: { wkid: 4326 },
              })

              const symbol = new SimpleFillSymbol({
                color: hexToRgba(color, alpha),
                outline: new SimpleLineSymbol({
                  color: hexToRgba(color, 0.8),
                  width: 1,
                }),
              })

              const graphic = new Graphic({
                geometry: polygon,
                symbol,
                attributes: {
                  country: item.country,
                  level: level,
                  item: item,
                },
              })

              graphicsLayer.add(graphic)
            }
            countryGraphicsRef.current.set(
              item.country,
              graphicsLayer.graphics.getItemAt(
                graphicsLayer.graphics.length - 1
              )
            )
          }
        }
      } else if (geoJson.type === 'Feature' && geoJson.geometry) {
        const geometry = geoJson.geometry
        if (geometry.type === 'Polygon') {
          const outerRing = geometry.coordinates[0].map((coord: number[]) => [
            coord[0],
            coord[1],
          ])
          const polygon = new Polygon({
            rings: [outerRing],
            spatialReference: { wkid: 4326 },
          })

          const symbol = new SimpleFillSymbol({
            color: hexToRgba(color, alpha),
            outline: new SimpleLineSymbol({
              color: hexToRgba(color, 0.8),
              width: 1,
            }),
          })

          const graphic = new Graphic({
            geometry: polygon,
            symbol,
            attributes: {
              country: item.country,
              level: level,
              item: item,
            },
          })

          graphicsLayer.add(graphic)
          countryGraphicsRef.current.set(item.country, graphic)
        } else if (geometry.type === 'MultiPolygon') {
          for (const polygonCoords of geometry.coordinates) {
            const outerRing = polygonCoords[0].map((coord: number[]) => [
              coord[0],
              coord[1],
            ])
            const polygon = new Polygon({
              rings: [outerRing],
              spatialReference: { wkid: 4326 },
            })

            const symbol = new SimpleFillSymbol({
              color: hexToRgba(color, alpha),
              outline: new SimpleLineSymbol({
                color: hexToRgba(color, 0.8),
                width: 1,
              }),
            })

            const graphic = new Graphic({
              geometry: polygon,
              symbol,
              attributes: {
                country: item.country,
                level: level,
                item: item,
              },
            })

            graphicsLayer.add(graphic)
          }
          countryGraphicsRef.current.set(
            item.country,
            graphicsLayer.graphics.getItemAt(graphicsLayer.graphics.length - 1)
          )
        }
      }
    } catch {}
  }
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
