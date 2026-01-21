import { useEffect, useRef } from 'react'
import { Cartesian3, Ion, SceneMode, Viewer } from 'cesium'

const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined

export const useCesiumViewer = (
  containerRef: React.RefObject<HTMLDivElement | null>
) => {
  const viewerRef = useRef<Viewer | null>(null)

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    if (ionToken) {
      Ion.defaultAccessToken = ionToken
    }

    const viewer = new Viewer(containerRef.current, {
      animation: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      timeline: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      sceneMode: SceneMode.SCENE2D,
    })

    viewer.scene.globe.enableLighting = true
    viewer.scene.globe.depthTestAgainstTerrain = false
    viewer.camera.setView({
      destination: Cartesian3.fromDegrees(120, 15, 25000000),
    })

    viewerRef.current = viewer

    return () => {
      viewer.destroy()
      viewerRef.current = null
    }
  }, [containerRef])

  return viewerRef
}
