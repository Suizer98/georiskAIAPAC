import ArcGISMap from '../map/ArcGISMap'

export default function MapBackground() {
  return (
    <div className="fixed inset-0 z-0">
      <ArcGISMap />
    </div>
  )
}
