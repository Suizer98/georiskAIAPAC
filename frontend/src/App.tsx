import { useEffect } from 'react'
import ChatDrawer from './components/layout/ChatDrawer'
import MapBackground from './components/layout/MapBackground'
import TopBar from './components/layout/TopBar'
import * as riskStore from './store/riskStore'

function App() {
  useEffect(() => {
    riskStore.startRiskStream()
    return () => riskStore.stopRiskStream()
  }, [])

  return (
    <div>
      <MapBackground />
      <TopBar />
      <ChatDrawer />
    </div>
  )
}

export default App
