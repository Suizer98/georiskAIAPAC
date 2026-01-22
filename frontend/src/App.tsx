import { useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import ChatDrawer from './components/layout/ChatDrawer'
import MapBackground from './components/layout/MapBackground'
import TopBar from './components/layout/TopBar'
import * as riskStore from './store/riskStore'
import { useRiskStore } from './store/riskStore'
import { useLayerStore } from './store/layerStore'

function App() {
  const lastEvent = useRiskStore((state) => state.lastEvent)
  const [showToast, setShowToast] = useState(false)
  const toastTimer = useRef<number | null>(null)
  const location = useLocation()
  const setLayer = useLayerStore((state) => state.setLayer)

  useEffect(() => {
    riskStore.startRiskStream()
    return () => riskStore.stopRiskStream()
  }, [])

  useEffect(() => {
    if (location.pathname.startsWith('/price')) {
      setLayer('risk', false)
      setLayer('price', true)
      return
    }
    setLayer('price', false)
    setLayer('risk', true)
  }, [location.pathname, setLayer])

  useEffect(() => {
    if (!lastEvent) {
      return
    }
    setShowToast(true)
    if (toastTimer.current) {
      window.clearTimeout(toastTimer.current)
    }
    toastTimer.current = window.setTimeout(() => {
      setShowToast(false)
    }, 3000)
  }, [lastEvent?.at, lastEvent?.id, lastEvent?.type])

  return (
    <div>
      <MapBackground />
      <TopBar />
      <ChatDrawer />
      <Routes>
        <Route path="/" element={<Navigate to="/risk" replace />} />
        <Route path="/risk" element={null} />
        <Route path="/price" element={null} />
      </Routes>
      {showToast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-slate-900/90 px-4 py-3 text-sm text-white shadow-lg">
          Risk score updated just now.
        </div>
      ) : null}
    </div>
  )
}

export default App
