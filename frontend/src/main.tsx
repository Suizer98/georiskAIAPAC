import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Cesium assets are served from /cesium via vite-plugin-cesium.
window.CESIUM_BASE_URL = '/cesium'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
