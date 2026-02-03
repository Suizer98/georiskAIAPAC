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

const WORLD_GEOJSON_URL =
  'https://cdn.jsdelivr.net/gh/datasets/geo-countries@main/data/countries.geojson'
let worldGeoJsonCache: { type: string; features: any[] } | null = null

async function getWorldGeoJson(): Promise<{
  type: string
  features: any[]
} | null> {
  if (
    worldGeoJsonCache?.type === 'FeatureCollection' &&
    Array.isArray(worldGeoJsonCache.features)
  ) {
    return worldGeoJsonCache
  }
  try {
    const res = await fetch(WORLD_GEOJSON_URL)
    if (!res.ok) return null
    const json = await res.json()
    if (json?.type === 'FeatureCollection' && Array.isArray(json.features)) {
      worldGeoJsonCache = json
      return json
    }
  } catch {
    // ignore
  }
  return null
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
  const doubleClickHandlerRef = useRef<any>(null)
  const hoverRef = useRef<Graphic | null>(null)
  const pointerOverAdvisoryRef = useRef(false)

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

            pointerOverAdvisoryRef.current = !!graphic
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
            } else if (!graphic) {
              pointerOverAdvisoryRef.current = false
              if (hoverRef.current) {
                onSelect(null)
                hoverRef.current = null
              }
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

      doubleClickHandlerRef.current = view.on('double-click', (event: any) => {
        if (view.destroyed) return
        if (
          pointerOverAdvisoryRef.current &&
          typeof event.stopPropagation === 'function'
        ) {
          event.stopPropagation()
        }
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
      if (doubleClickHandlerRef.current) {
        doubleClickHandlerRef.current.remove()
        doubleClickHandlerRef.current = null
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

      // Look up travel advisory by ISO2 (backend returns country_code=iso2).
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

      const worldGeoJson = await getWorldGeoJson()
      if (!worldGeoJson) return

      // GeoJSON (geo-countries) uses ISO3166-1-Alpha-2 / iso_a2; match by ISO2 only.
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

      const allGraphics: Graphic[] = []
      const countryToFirstGraphic = new Map<string, Graphic>()

      for (const iso2 of APAC_ISO2_CODES) {
        try {
          const countryFeature = worldGeoJson.features.find((feature: any) =>
            matchByIso2(feature, iso2)
          )
          if (!countryFeature) continue

          const item: TravelAdvisoryItem = findAdvisory(iso2) ?? {
            country: iso2,
            level: null,
          }

          const countryGeoJson = {
            type: 'FeatureCollection',
            features: [countryFeature],
          }

          const graphics = buildGraphicsFromGeoJson(countryGeoJson, item)
          if (graphics.length > 0) {
            countryToFirstGraphic.set(item.country, graphics[0])
            allGraphics.push(...graphics)
          }
        } catch {
          // skip country on bad geometry
        }
      }

      if (allGraphics.length > 0) {
        graphicsLayer.addMany(allGraphics)
        countryToFirstGraphic.forEach((graphic, country) => {
          countryGraphicsRef.current.set(country, graphic)
        })
      }
    }

    if (enabled) {
      loadCountryBoundaries()
    }
  }, [travelAdvisoryData, enabled, viewRef])
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

// Reduce ring to maxPoints vertices (keeps shape, lowers draw cost).
function simplifyRing(ring: number[][], maxPoints: number): number[][] {
  if (ring.length <= maxPoints) return ring.map((c) => [c[0], c[1]])
  const step = (ring.length - 1) / (maxPoints - 1)
  const out: number[][] = []
  for (let i = 0; i < maxPoints; i++) {
    const idx = i === maxPoints - 1 ? ring.length - 1 : Math.round(i * step)
    const c = ring[idx]
    out.push([c[0], c[1]])
  }
  return out
}

const MAX_RING_POINTS = 200

// Build an array of Graphics from GeoJSON (sync, no layer). Used to batch addMany.
function buildGraphicsFromGeoJson(
  geoJson: any,
  item: TravelAdvisoryItem
): Graphic[] {
  const out: Graphic[] = []
  const level = item.level
  const color = getLevelColor(level)
  const alpha = level === null ? 0.1 : 0.4

  const makeGraphic = (rings: number[][][]): Graphic => {
    const rawRing = rings[0].map((c: number[]) => [c[0], c[1]])
    const outerRing = simplifyRing(rawRing, MAX_RING_POINTS)
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
    return new Graphic({
      geometry: polygon,
      symbol,
      attributes: {
        country: item.country,
        level: level,
        item: item,
      },
    })
  }

  const features = (
    geoJson.type === 'FeatureCollection' && Array.isArray(geoJson.features)
      ? geoJson.features
      : geoJson.type === 'Feature'
        ? [geoJson]
        : []
  ) as Array<{ geometry?: any }>

  for (const feature of features) {
    if (!feature?.geometry) continue
    const geometry = feature.geometry
    if (geometry.type === 'Polygon') {
      out.push(makeGraphic(geometry.coordinates))
    } else if (geometry.type === 'MultiPolygon') {
      for (const polygonCoords of geometry.coordinates) {
        const exteriorRing = polygonCoords[0]
        if (exteriorRing?.length) out.push(makeGraphic([exteriorRing]))
      }
    }
  }
  return out
}
