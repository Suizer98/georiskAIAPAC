import CesiumMap from '../map/CesiumMap'

export default function MapBackground() {
  return (
    <div className="fixed inset-0 z-0">
      <CesiumMap />
    </div>
  )
}
