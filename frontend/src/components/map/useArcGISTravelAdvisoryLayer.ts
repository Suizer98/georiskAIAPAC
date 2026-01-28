import { useEffect, useRef } from 'react'
import MapView from '@arcgis/core/views/MapView'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import Graphic from '@arcgis/core/Graphic'
import Polygon from '@arcgis/core/geometry/Polygon'
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol'
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol'
import type { TravelAdvisoryItem } from '../../store/travelAdvisoryStore'
import type { MapPopupSelection } from './MapPopup'

// Color mapping for travel advisory levels
const LEVEL_COLORS: Record<number, string> = {
  1: '#22c55e', // Green - Exercise normal precautions
  2: '#eab308', // Yellow - Exercise increased caution
  3: '#f97316', // Orange - Reconsider travel
  4: '#ef4444', // Red - Do not travel
}

const getLevelColor = (level: number | null): string => {
  if (level === null || level < 1 || level > 4) {
    return '#6b7280' // Gray for unknown/no data
  }
  return LEVEL_COLORS[level] || '#6b7280'
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

  // Set layer title for LayerList widget
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

    // Create graphics layer with title
    // Add it at the bottom so it appears behind other layers
    const graphicsLayer = new GraphicsLayer({
      title: 'Travel Advisory Levels',
      opacity: 0.7, // Slightly transparent so other layers show through
    })
    view.map.add(graphicsLayer)
    // Move to bottom of layer stack
    view.map.reorder(graphicsLayer, 0)
    graphicsLayerRef.current = graphicsLayer

    // Setup hover handler to show popup
    if (onSelect) {
      hoverHandlerRef.current = view.on('pointer-move', (event: any) => {
        if (view.destroyed) return
        view.hitTest(event).then((response: any) => {
          if (view.destroyed) return
          const graphic = response.results.find(
            (result: any) => result.graphic?.layer === graphicsLayer
          )?.graphic as Graphic | undefined

          // If hovering over a different graphic, update popup
          if (graphic && graphic !== hoverRef.current) {
            const item = graphic.attributes?.item as TravelAdvisoryItem | undefined
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
            // Mouse moved away from any graphic, hide popup
            onSelect(null)
            hoverRef.current = null
          }
        }).catch(() => {
          // Ignore hitTest errors
        })
      })

      // Setup click handler to show popup
      clickHandlerRef.current = view.on('click', (event: any) => {
        if (view.destroyed) return
        view.hitTest(event).then((response: any) => {
          if (view.destroyed) return
          const graphic = response.results.find(
            (result: any) => result.graphic?.layer === graphicsLayer
          )?.graphic as Graphic | undefined

          if (graphic) {
            const item = graphic.attributes.item as TravelAdvisoryItem | undefined
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
        }).catch(() => {
          // Ignore hitTest errors
        })
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
        } catch (error) {
          console.warn('Failed to remove travel advisory graphics layer:', error)
        }
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

    // Fetch country boundaries and render them
    const loadCountryBoundaries = async () => {
      // Remove existing graphics
      graphicsLayer.removeAll()
      countryGraphicsRef.current.clear()

      // Country name to ISO3 code mapping for GeoJSON matching
      const countryToISO3: Record<string, string> = {
        'Australia': 'AUS',
        'Brunei': 'BRN',
        'Cambodia': 'KHM',
        'China': 'CHN',
        'Hong Kong': 'HKG',
        'India': 'IND',
        'Indonesia': 'IDN',
        'Japan': 'JPN',
        'Laos': 'LAO',
        'Malaysia': 'MYS',
        'Myanmar': 'MMR',
        'New Zealand': 'NZL',
        'Philippines': 'PHL',
        'Singapore': 'SGP',
        'South Korea': 'KOR',
        'Taiwan': 'TWN',
        'Thailand': 'THA',
        'Vietnam': 'VNM',
      }

      // Country name to ISO2 code mapping for fallback matching
      const countryToISO2: Record<string, string> = {
        'Australia': 'AU',
        'Brunei': 'BN',
        'Cambodia': 'KH',
        'China': 'CN',
        'Hong Kong': 'HK',
        'India': 'IN',
        'Indonesia': 'ID',
        'Japan': 'JP',
        'Laos': 'LA',
        'Malaysia': 'MY',
        'Myanmar': 'MM',
        'New Zealand': 'NZ',
        'Philippines': 'PH',
        'Singapore': 'SG',
        'South Korea': 'KR',
        'Taiwan': 'TW',
        'Thailand': 'TH',
        'Vietnam': 'VN',
      }

      let successCount = 0
      let errorCount = 0

      // Fetch the world GeoJSON file once
      let worldGeoJson: any = null
      try {
        const worldGeoJsonUrl = 'https://raw.githubusercontent.com/datasets/geo-countries/main/data/countries.geojson'
        const worldResponse = await fetch(worldGeoJsonUrl)
        if (!worldResponse.ok) {
          throw new Error(`Failed to fetch world GeoJSON: ${worldResponse.status}`)
        }
        worldGeoJson = await worldResponse.json()
      } catch (error) {
        console.error('Failed to load world GeoJSON:', error)
        return
      }

      if (!worldGeoJson || worldGeoJson.type !== 'FeatureCollection' || !Array.isArray(worldGeoJson.features)) {
        console.error('Invalid world GeoJSON format')
        return
      }

      // Process each travel advisory item
      for (const item of travelAdvisoryData) {
        if (!item.country) {
          console.warn('Skipping item with no country')
          continue
        }

        try {
          const iso3 = countryToISO3[item.country]
          if (!iso3) {
            console.warn(`No ISO3 code found for ${item.country}`)
            errorCount++
            continue
          }

          // Find matching country in world GeoJSON
          const countryFeature = worldGeoJson.features.find((feature: any) => {
            // Match by ISO3 code (id field) - check both string and number
            if (feature.id === iso3 || feature.id === iso3.toLowerCase() || String(feature.id) === iso3) {
              return true
            }
            
            // Match by ISO3 code in properties
            const props = feature.properties || {}
            if (props.iso_a3 === iso3 || props.ISO_A3 === iso3 || props.ISO3 === iso3 || 
                props.iso3 === iso3 || props.ISO_A3_EH === iso3 ||
                props['ISO3166-1-Alpha-3'] === iso3 || props['iso3166-1-alpha-3'] === iso3) {
              return true
            }
            
            // Match by ISO2 code in properties (fallback)
            const iso2 = countryToISO2[item.country]
            if (iso2 && (props.iso_a2 === iso2 || props.ISO_A2 === iso2 || props.ISO2 === iso2 || 
                         props.iso2 === iso2 || props.ISO_A2_EH === iso2 ||
                         props['ISO3166-1-Alpha-2'] === iso2 || props['iso3166-1-alpha-2'] === iso2)) {
              return true
            }
            
            // Match by country name in properties - check multiple possible fields
            const nameFields = ['name', 'NAME', 'NAME_LONG', 'NAME_EN', 'NAME_ENG', 'admin', 'ADMIN', 'country', 'COUNTRY']
            const countryLower = item.country.toLowerCase()
            
            for (const field of nameFields) {
              const name = props[field] || ''
              const nameLower = name.toLowerCase()
              
              // Check exact match only
              if (nameLower === countryLower) {
                return true
              }
            }
            
            return false
          })

          if (!countryFeature) {
            console.warn(`Country feature not found in GeoJSON for ${item.country} (${iso3})`)
            errorCount++
            continue
          }
          
          // Create a FeatureCollection with just this country
          const countryGeoJson = {
            type: 'FeatureCollection',
            features: [countryFeature]
          }
          
          await renderCountryGeometry(countryGeoJson, item, graphicsLayer)
          successCount++
          
        } catch (error) {
          console.warn(`Failed to process boundary for ${item.country}:`, error)
          errorCount++
        }
      }
    }

    if (enabled && travelAdvisoryData.length > 0) {
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

      // Convert GeoJSON to ArcGIS geometry
      if (geoJson.type === 'FeatureCollection' && Array.isArray(geoJson.features)) {
        for (const feature of geoJson.features) {
          if (!feature.geometry) continue
          
          const geometry = feature.geometry
          if (geometry.type === 'Polygon') {
            // Polygon: coordinates is an array of rings (first is outer, rest are holes)
            const outerRing = geometry.coordinates[0].map((coord: number[]) => [coord[0], coord[1]])
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
                item: item, // Store full item for popup
              },
            })

            graphicsLayer.add(graphic)
            countryGraphicsRef.current.set(item.country, graphic)
          } else if (geometry.type === 'MultiPolygon') {
            // MultiPolygon: coordinates is an array of polygons
            for (const polygonCoords of geometry.coordinates) {
              const outerRing = polygonCoords[0].map((coord: number[]) => [coord[0], coord[1]])
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
                  item: item, // Store full item for popup
                },
              })

              graphicsLayer.add(graphic)
            }
            countryGraphicsRef.current.set(item.country, graphicsLayer.graphics.getItemAt(graphicsLayer.graphics.length - 1))
          } else {
            console.warn(`Unsupported geometry type: ${geometry.type} for ${item.country}`)
          }
        }
      } else if (geoJson.type === 'Feature' && geoJson.geometry) {
        // Handle single feature
        const geometry = geoJson.geometry
        if (geometry.type === 'Polygon') {
          const outerRing = geometry.coordinates[0].map((coord: number[]) => [coord[0], coord[1]])
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
              item: item, // Store full item for popup
            },
          })

          graphicsLayer.add(graphic)
          countryGraphicsRef.current.set(item.country, graphic)
        } else if (geometry.type === 'MultiPolygon') {
          for (const polygonCoords of geometry.coordinates) {
            const outerRing = polygonCoords[0].map((coord: number[]) => [coord[0], coord[1]])
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
                item: item, // Store full item for popup
              },
            })

            graphicsLayer.add(graphic)
          }
          countryGraphicsRef.current.set(item.country, graphicsLayer.graphics.getItemAt(graphicsLayer.graphics.length - 1))
        }
      }
    } catch (error) {
      console.warn(`Failed to render geometry for ${item.country}:`, error)
    }
  }
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
