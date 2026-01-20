import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const mcpTarget = env.VITE_BACKEND_MCP || 'http://localhost:8000'
  const agentTarget = env.VITE_BACKEND_AGENT || 'http://localhost:7000'

  return {
    plugins: [react(), cesium()],
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/api/chat': {
          target: agentTarget,
          changeOrigin: true,
        },
        '/api': {
          target: mcpTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
