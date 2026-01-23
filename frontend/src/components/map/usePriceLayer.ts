import { useEffect, useRef } from 'react'
import {
  Cartesian3,
  Color,
  CustomDataSource,
  HeightReference,
  LabelStyle,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  VerticalOrigin,
  Viewer,
} from 'cesium'
import type { PriceItem } from '../../store/priceStore'
import type { MapPopupSelection } from './MapPopup'

export const usePriceLayer = (
  viewerRef: React.RefObject<Viewer | null>,
  priceData: PriceItem[],
  enabled: boolean,
  onSelect: (data: MapPopupSelection | null) => void
) => {
  const dataSourceRef = useRef<CustomDataSource | null>(null)
  const hoverRef = useRef<any>(null)
  const hoverHandlerRef = useRef<ScreenSpaceEventHandler | null>(null)
  const clickHandlerRef = useRef<ScreenSpaceEventHandler | null>(null)

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) {
      return
    }

    const dataSource = new CustomDataSource('price-pois')
    viewer.dataSources.add(dataSource)
    dataSourceRef.current = dataSource

    hoverHandlerRef.current = new ScreenSpaceEventHandler(viewer.scene.canvas)
    hoverHandlerRef.current.setInputAction((movement: any) => {
      const picked = viewer.scene.pick(movement.endPosition)
      const entity = picked?.id
      // Check if this entity belongs to our data source
      if (entity && !dataSource.entities.contains(entity)) {
        return
      }

      if (hoverRef.current && hoverRef.current !== entity) {
        if (hoverRef.current.point) {
          hoverRef.current.point.color = Color.GOLD.withAlpha(0.8)
          hoverRef.current.point.pixelSize = 12
          hoverRef.current.label.show = false
        }
        hoverRef.current = null
      }

      if (entity && entity.point) {
        entity.point.color = Color.WHITE
        entity.point.pixelSize = 16
        entity.label.show = true
        hoverRef.current = entity
      }
    }, ScreenSpaceEventType.MOUSE_MOVE)

    clickHandlerRef.current = new ScreenSpaceEventHandler(viewer.scene.canvas)
    clickHandlerRef.current.setInputAction((click: any) => {
      const picked = viewer.scene.pick(click.position)
      const entity = picked?.id

      if (entity && dataSource.entities.contains(entity)) {
        const item = entity.properties.item.getValue()
        const rect = viewer.scene.canvas.getBoundingClientRect()
        const position =
          entity.position?.getValue(viewer.clock.currentTime) ??
          Cartesian3.fromDegrees(item.longitude, item.latitude)
        onSelect({
          x: rect.left + click.position.x,
          y: rect.top + click.position.y,
          position,
          payload: { type: 'price', item },
        })
      }
    }, ScreenSpaceEventType.LEFT_CLICK)

    return () => {
      if (hoverHandlerRef.current) {
        hoverHandlerRef.current.destroy()
        hoverHandlerRef.current = null
      }
      if (clickHandlerRef.current) {
        clickHandlerRef.current.destroy()
        clickHandlerRef.current = null
      }
      if (viewer && !viewer.isDestroyed() && dataSourceRef.current) {
        viewer.dataSources.remove(dataSourceRef.current, true)
      }
      dataSourceRef.current = null
    }
  }, [viewerRef, onSelect])

  useEffect(() => {
    const dataSource = dataSourceRef.current
    if (!dataSource) {
      return
    }

    dataSource.show = enabled
    dataSource.entities.removeAll()

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
      
      dataSource.entities.add({
        position: Cartesian3.fromDegrees(item.longitude, item.latitude),
        point: {
          pixelSize: 12,
          color: Color.GOLD.withAlpha(0.8),
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          heightReference: HeightReference.NONE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: item.country,
          font: '14px sans-serif',
          show: false, 
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 3,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian3(0, -15, 0),
          heightReference: HeightReference.NONE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        properties: { item: item },
      })
    })

    viewerRef.current?.scene.requestRender()
  }, [priceData, enabled, viewerRef])
}
