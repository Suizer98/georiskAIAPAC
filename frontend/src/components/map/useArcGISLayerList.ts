import { useEffect, useRef } from 'react'
import MapView from '@arcgis/core/views/MapView'
import LayerList from '@arcgis/core/widgets/LayerList'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'

export const useArcGISLayerList = (
  viewRef: React.RefObject<MapView | null>,
  visibleLayerTitles: string[],
  isOpen: boolean
) => {
  const layerListRef = useRef<LayerList | null>(null)

  useEffect(() => {
    const view = viewRef.current
    if (!view) {
      return
    }

    const setupLayerList = () => {
      // Remove existing widget if it exists
      if (layerListRef.current) {
        try {
          const positionObserver = (layerListRef.current as any)._positionObserver
          const positionInterval = (layerListRef.current as any)._positionInterval
          if (positionObserver) positionObserver.disconnect()
          if (positionInterval) clearInterval(positionInterval)
          view.ui.remove(layerListRef.current)
        } catch (e) {
          // Ignore errors
        }
        layerListRef.current = null
      }

      // Create LayerList widget with proper filtering
      const layerList = new LayerList({
        view: view,
        listItemCreatedFunction: (event) => {
          const item = event.item
          const layer = item.layer
          
          // Hide basemap
          try {
            const basemapLayer = view.map.basemap.baseLayers.getItemAt(0)
            if (layer === basemapLayer) {
              item.visible = false
              return
            }
          } catch (e) {
            // Ignore
          }
          
          // Filter graphics layers - only show those in visibleLayerTitles
          if (layer instanceof GraphicsLayer) {
            const layerTitle = layer.title || ''
            if (!visibleLayerTitles.includes(layerTitle)) {
              // Completely hide the item
              item.visible = false
              // Also hide the DOM element when it's rendered
              const hideElement = () => {
                if (item.element) {
                  const el = item.element as HTMLElement
                  el.style.display = 'none'
                  el.style.visibility = 'hidden'
                  el.style.height = '0'
                  el.style.margin = '0'
                  el.style.padding = '0'
                  // Also hide parent row if it exists
                  const parent = el.closest('.esri-layer-list__item')
                  if (parent) {
                    (parent as HTMLElement).style.display = 'none'
                  }
                }
              }
              // Try immediately and after a delay
              hideElement()
              setTimeout(hideElement, 0)
              setTimeout(hideElement, 100)
              return
            }
            item.actionsVisible = true
            item.open = true
            
            // Add icon when item is created
            const addIconToItem = () => {
              if (!item.element) return
              const titleEl = item.element.querySelector('.esri-layer-list__item-title') as HTMLElement
              if (!titleEl) return
              
              // Check if icon already exists
              if (titleEl.querySelector('.layer-icon')) return
              
              const icon = document.createElement('div')
              icon.className = 'layer-icon'
              
              let bgColor = '#999'
              let borderColor = 'rgba(255, 255, 255, 0.3)'
              
              if (layerTitle === 'Risk Heatmap') {
                bgColor = '#f97316'
              } else if (layerTitle === 'Metals Price') {
                bgColor = '#d4af37'
                borderColor = 'rgba(0, 0, 0, 0.3)'
              } else if (layerTitle === 'JP Morgan Offices') {
                bgColor = '#0066cc'
              }
              
              icon.style.cssText = `
                display: inline-block;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                margin-right: 8px;
                vertical-align: middle;
                flex-shrink: 0;
                background-color: ${bgColor};
                border: 1px solid ${borderColor};
              `
              
              // Insert at the beginning
              titleEl.insertBefore(icon, titleEl.firstChild)
            }
            
            // Try to add icon when element is available
            if (item.element) {
              addIconToItem()
            } else {
              // Wait for element to be created
              const checkElement = setInterval(() => {
                if (item.element) {
                  addIconToItem()
                  clearInterval(checkElement)
                }
              }, 50)
              setTimeout(() => clearInterval(checkElement), 2000)
            }
          }
        },
      })
      
      // Add icons to legend items and hide unwanted ones
      const addIconsAndHideUnwanted = () => {
        const container = layerList.container as HTMLElement
        if (!container) return
        
        // Try multiple selectors to find title elements
        const titleSelectors = [
          '.esri-layer-list__item-title',
          '.esri-layer-list__item-title-text',
          '[class*="title"]'
        ]
        
        container.querySelectorAll('.esri-layer-list__item').forEach((el) => {
          const htmlEl = el as HTMLElement
          const text = el.textContent || ''
          
          // Check if should hide
          const shouldHide = 
            (text.includes('Metals Price') && !visibleLayerTitles.includes('Metals Price')) ||
            (text.includes('Risk Heatmap') && !visibleLayerTitles.includes('Risk Heatmap')) ||
            (text.includes('JP Morgan Offices') && !visibleLayerTitles.includes('JP Morgan Offices'))
          
          if (shouldHide) {
            htmlEl.style.display = 'none'
            htmlEl.style.visibility = 'hidden'
            htmlEl.style.height = '0'
            htmlEl.style.margin = '0'
            htmlEl.style.padding = '0'
            return
          }
          
          // Find title element using multiple selectors
          let titleElement: HTMLElement | null = null
          for (const selector of titleSelectors) {
            titleElement = el.querySelector(selector) as HTMLElement
            if (titleElement) break
          }
          
          // If no title element found, try to find any element with text content
          if (!titleElement) {
            const allElements = el.querySelectorAll('*')
            for (const elem of Array.from(allElements)) {
              if (elem.textContent && (elem.textContent.includes('Risk Heatmap') || 
                  elem.textContent.includes('Metals Price') || 
                  elem.textContent.includes('JP Morgan Offices'))) {
                titleElement = elem as HTMLElement
                break
              }
            }
          }
          
          if (titleElement && !titleElement.querySelector('.layer-icon')) {
            const icon = document.createElement('div')
            icon.className = 'layer-icon'
            
            let bgColor = '#999'
            let borderColor = 'rgba(255, 255, 255, 0.3)'
            
            if (text.includes('Risk Heatmap')) {
              bgColor = '#f97316'
            } else if (text.includes('Metals Price')) {
              bgColor = '#d4af37'
              borderColor = 'rgba(0, 0, 0, 0.3)'
            } else if (text.includes('JP Morgan Offices')) {
              bgColor = '#0066cc'
            }
            
            icon.style.cssText = `
              display: inline-block;
              width: 12px;
              height: 12px;
              border-radius: 50%;
              margin-right: 8px;
              vertical-align: middle;
              flex-shrink: 0;
              background-color: ${bgColor};
              border: 1px solid ${borderColor};
            `
            
            // Insert icon at the beginning
            titleElement.insertBefore(icon, titleElement.firstChild)
          }
        })
      }
      
      // Watch container for changes
      const listObserver = new MutationObserver(addIconsAndHideUnwanted)
      
      // Try multiple times with increasing delays
      const tryAddIcons = () => {
        const container = layerList.container as HTMLElement
        if (container) {
          listObserver.observe(container, { childList: true, subtree: true })
          addIconsAndHideUnwanted()
        }
      }
      
      // Try immediately and with delays
      tryAddIcons()
      setTimeout(tryAddIcons, 100)
      setTimeout(tryAddIcons, 300)
      setTimeout(tryAddIcons, 500)
      setTimeout(tryAddIcons, 1000)
      
      const hideInterval = setInterval(addIconsAndHideUnwanted, 200)
      
      ;(layerList as any)._listObserver = listObserver
      ;(layerList as any)._hideInterval = hideInterval

      // Add widget to view
      view.ui.add(layerList, {
        position: 'top-right',
        index: 0,
      })
      
      // Adjust position below header and button
      const adjustPosition = () => {
        const container = layerList.container as HTMLElement
        if (container) {
          container.style.setProperty('top', '150px', 'important')
          container.style.setProperty('right', '15px', 'important')
          container.style.setProperty('position', 'absolute', 'important')
          container.style.setProperty('display', isOpen ? 'block' : 'none', 'important')
        }
      }
      
      adjustPosition()
      
      // Watch for position changes
      const positionObserver = new MutationObserver(adjustPosition)
      if (view.container) {
        positionObserver.observe(view.container, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class'],
        })
      }
      
      const positionInterval = setInterval(adjustPosition, 500)
      
      // Store references
      ;(layerList as any)._positionObserver = positionObserver
      ;(layerList as any)._positionInterval = positionInterval
      layerListRef.current = layerList
    }

    // Wait for view to be ready
    if (view.ready) {
      setupLayerList()
    } else {
      view.when(() => {
        setupLayerList()
      }).catch((error) => {
        console.error('Error setting up LayerList:', error)
      })
    }

    return () => {
      if (layerListRef.current && view && !view.destroyed) {
        try {
          const positionObserver = (layerListRef.current as any)._positionObserver
          const positionInterval = (layerListRef.current as any)._positionInterval
          const listObserver = (layerListRef.current as any)._listObserver
          const hideInterval = (layerListRef.current as any)._hideInterval
          
          if (positionObserver) positionObserver.disconnect()
          if (positionInterval) clearInterval(positionInterval)
          if (listObserver) listObserver.disconnect()
          if (hideInterval) clearInterval(hideInterval)
          
          view.ui.remove(layerListRef.current)
        } catch (e) {
          // Ignore cleanup errors
        }
        layerListRef.current = null
      }
    }
  }, [viewRef, visibleLayerTitles, isOpen])
  
  // Update visibility when isOpen changes
  useEffect(() => {
    if (layerListRef.current?.container) {
      const container = layerListRef.current.container as HTMLElement
      container.style.setProperty('display', isOpen ? 'block' : 'none', 'important')
    }
  }, [isOpen])
}
