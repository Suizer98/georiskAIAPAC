import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import * as Toast from '@radix-ui/react-toast'
import ChatDrawer from './components/layout/ChatDrawer'
import MapBackground from './components/layout/MapBackground'
import TopBar from './components/layout/TopBar'
import * as riskStore from './store/riskStore'
import { useRiskStore } from './store/riskStore'
import { useLayerStore } from './store/layerStore'

function App() {
  const lastEvent = useRiskStore((state) => state.lastEvent)
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const setLayer = useLayerStore((state) => state.setLayer)

  useEffect(() => {
    riskStore.startRiskStream()
    return () => riskStore.stopRiskStream()
  }, [])

  useEffect(() => {
    if (location.pathname.startsWith('/market')) {
      setLayer('risk', false)
      setLayer('travel_advisory', false)
      setLayer('jpmorgan', false)
      setLayer('price', true)
      return
    }
    setLayer('price', false)
    setLayer('risk', true)
    setLayer('travel_advisory', true)
    setLayer('jpmorgan', true)
  }, [location.pathname, setLayer])

  useEffect(() => {
    if (!lastEvent) return
    setOpen(true)
  }, [lastEvent?.at, lastEvent?.id, lastEvent?.type])

  return (
    <Toast.Provider duration={3000} swipeDirection="up">
      <div>
        <MapBackground />
        <TopBar />
        <ChatDrawer />
        <Routes>
          <Route path="/" element={<Navigate to="/risk" replace />} />
          <Route path="/risk" element={null} />
          <Route path="/market" element={null} />
        </Routes>
      </div>
      <Toast.Root
        open={open}
        onOpenChange={setOpen}
        className="fixed left-1/2 top-28 z-50 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-8 py-5 text-base font-medium text-slate-800 shadow-xl transition-[opacity,transform] duration-200 data-[state=closed]:translate-y-[-100%] data-[state=closed]:opacity-0"
      >
        <Toast.Title className="sr-only">Risk updated</Toast.Title>
        <Toast.Description>Risk score updated.</Toast.Description>
      </Toast.Root>
      <Toast.Viewport className="fixed inset-0 z-[100] flex justify-center pt-28 outline-none pointer-events-none [&>*]:pointer-events-auto" />
    </Toast.Provider>
  )
}

export default App
