import { useEffect } from 'react'
import MapView from '@arcgis/core/views/MapView'

const ZOOM_LEVEL = 6

export function useMapActions(viewRef: React.RefObject<MapView | null>) {
  useEffect(() => {
    const view = viewRef.current
    if (!view || view.destroyed) return

    const es = new EventSource('/api/map-actions/events')
    es.onmessage = (e) => {
      try {
        const a = JSON.parse(e.data) as { type?: string; center?: number[] }
        if (
          a?.type === 'zoom_to_place' &&
          Array.isArray(a?.center) &&
          a.center.length >= 2
        ) {
          const [lng, lat] = a.center
          const v = viewRef.current
          if (
            v &&
            !v.destroyed &&
            typeof lng === 'number' &&
            typeof lat === 'number'
          ) {
            void v.goTo(
              { center: [lng, lat], zoom: ZOOM_LEVEL },
              { duration: 800 }
            )
          }
        }
      } catch {}
    }
    es.onerror = () => es.close()

    return () => es.close()
  }, [viewRef])
}
