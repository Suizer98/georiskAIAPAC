import { useEffect, useRef } from 'react'
import MapView from '@arcgis/core/views/MapView'
import Map from '@arcgis/core/Map'
import esriConfig from '@arcgis/core/config'

export const useArcGISViewer = (
  containerRef: React.RefObject<HTMLDivElement | null>
) => {
  const viewRef = useRef<MapView | null>(null)

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    if (import.meta.env.DEV) {
      esriConfig.assetsPath = '/node_modules/@arcgis/core/assets'
    } else {
      esriConfig.assetsPath = '/assets'
    }

    // Use dark basemap
    const map = new Map({ basemap: 'dark-gray' })
    const view = new MapView({
      container: containerRef.current,
      map: map,
      center: [103.8198, 1.3521], // Singapore coordinates
      zoom: 4, // Zoomed out to show wider APAC region
      ui: { components: [] },
    })

    viewRef.current = view

    return () => {
      if (view && !view.destroyed) {
        view.destroy()
      }
      viewRef.current = null
    }
  }, [containerRef])

  return viewRef
}
