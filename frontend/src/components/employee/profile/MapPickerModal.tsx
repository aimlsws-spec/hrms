/**
 * MapPickerModal — interactive OpenStreetMap (Leaflet) location picker.
 *
 * The employee can:
 *   • Click anywhere on the map to place the pin
 *   • Drag the existing marker to adjust
 *   • Confirm to save the selected coordinates
 *
 * No Google Maps API key required — uses free OSM tiles.
 */
import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default marker icons broken by Vite asset bundling
import markerIconPng    from 'leaflet/dist/images/marker-icon.png'
import markerIcon2xPng  from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadowPng  from 'leaflet/dist/images/marker-shadow.png'

const defaultIcon = new L.Icon({
  iconUrl:       markerIconPng,
  iconRetinaUrl: markerIcon2xPng,
  shadowUrl:     markerShadowPng,
  iconSize:      [25, 41],
  iconAnchor:    [12, 41],
  popupAnchor:   [1, -34],
  shadowSize:    [41, 41],
})

interface Props {
  initialLat:          number
  initialLon:          number
  hasInitialLocation:  boolean
  onSave:              (lat: number, lon: number) => void
  onClose:             () => void
}

interface LatLon { lat: number; lon: number }

// Inner component: handles map click-to-place
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) { onMapClick(e.latlng.lat, e.latlng.lng) },
  })
  return null
}

// Inner component: draggable marker
function DraggableMarker({
  position,
  onDragEnd,
}: {
  position: LatLon
  onDragEnd: (lat: number, lon: number) => void
}) {
  const markerRef = useRef<L.Marker>(null)

  return (
    <Marker
      ref={markerRef}
      position={[position.lat, position.lon]}
      icon={defaultIcon}
      draggable
      eventHandlers={{
        dragend() {
          const m = markerRef.current
          if (m) {
            const { lat, lng } = m.getLatLng()
            onDragEnd(lat, lng)
          }
        },
      }}
    />
  )
}

export default function MapPickerModal({ initialLat, initialLon, hasInitialLocation, onSave, onClose }: Props) {
  // Default to India centre when no prior location exists
  const [pin, setPin] = useState<LatLon>({
    lat: hasInitialLocation ? initialLat : 20.5937,
    lon: hasInitialLocation ? initialLon : 78.9629,
  })

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function handlePin(lat: number, lon: number) {
    setPin({ lat, lon })
  }

  const zoomLevel = hasInitialLocation ? 15 : 5

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <i className="fa-solid fa-map-location-dot text-indigo-500 text-[13px]" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-gray-800">Pick Home Location</p>
              <p className="text-[11px] text-gray-400">Click the map or drag the pin to your home</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <i className="fa-solid fa-xmark text-[15px]" />
          </button>
        </div>

        {/* Instruction banner */}
        <div className="bg-blue-50 border-b border-blue-100 px-5 py-2.5 flex items-center gap-2">
          <i className="fa-solid fa-circle-info text-blue-400 text-[11px] shrink-0" />
          <p className="text-[11px] text-blue-700">
            Tap anywhere to place your home pin, or drag the existing marker to the exact location.
            Use two fingers to zoom.
          </p>
        </div>

        {/* Map */}
        <div className="h-[360px] w-full relative">
          <MapContainer
            center={[pin.lat, pin.lon]}
            zoom={zoomLevel}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onMapClick={handlePin} />
            <DraggableMarker position={pin} onDragEnd={handlePin} />
          </MapContainer>
        </div>

        {/* Coordinates display + actions */}
        <div className="px-5 py-4 flex items-center justify-between gap-4 border-t border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-location-dot text-emerald-500 text-[12px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-gray-400 mb-0.5">Selected coordinates</p>
              <p className="text-[13px] font-mono font-semibold text-gray-800 truncate">
                {pin.lat.toFixed(6)},&nbsp;{pin.lon.toFixed(6)}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onClose}
              className="h-9 px-4 border border-gray-200 rounded-lg text-[12px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(pin.lat, pin.lon)}
              className="h-9 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <i className="fa-solid fa-check text-[11px]" />
              Confirm Location
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
