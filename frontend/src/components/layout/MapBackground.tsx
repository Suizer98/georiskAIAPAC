import CesiumMap from '../CesiumMap'

export default function MapBackground() {
  return (
    <div className="fixed inset-0 z-0">
      <CesiumMap />
    </div>
  )
}
