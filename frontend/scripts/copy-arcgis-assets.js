import { existsSync, cpSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const src = join(__dirname, '..', 'node_modules', '@arcgis', 'core', 'assets')
const dest = join(__dirname, '..', 'dist', 'assets')

if (existsSync(src)) {
  try {
    cpSync(src, dest, { recursive: true })
    console.log('✓ ArcGIS assets copied to dist/assets')
  } catch (error) {
    console.error('Failed to copy ArcGIS assets:', error)
  }
} else {
  console.warn('ArcGIS assets not found at:', src)
}
