import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

import { Circle, CircleMarker } from "react-leaflet";
import { isRestaurantOpenToday } from "../../utils/isRestaurantOpenToday.js";
import { isRestaurantAcceptingOrders } from "../../utils/isRestaurantAcceptingOrders.js";

function MapSetTo({ position }) {
  const map = useMap();
  useEffect(() => {
    if (!position) return;
    const savedZoom = parseInt(sessionStorage.getItem("userMapZoom"));
    const currentZoom = map.getZoom();
    if (!isNaN(savedZoom)) map.setView(position, savedZoom);
    else map.setView(position, currentZoom);
  }, [position, map]);
  return null;
}

function zoomLevelToKm(zoom) {
  const zoomToKm = {
    8: 100,
    9: 75,
    10: 50,
    11: 25,
    12: 10,
    13: 5,
    14: 2.5,
    15: 1.5,
    16: 1,
    17: 0.5,
    18: 0.25,
  };
  const radius = zoomToKm[zoom] || 100;
  return Math.min(radius, 100);
}

function ZoomToRadius({ setSearchRadius, setMapInstance }) {
  const map = useMap();
  useEffect(() => {
    setMapInstance?.(map);
    function handleZoom() {
      const zoom = map.getZoom();
      const radius = zoomLevelToKm(zoom);
      setSearchRadius?.(radius);
      sessionStorage.setItem("userMapZoom", zoom.toString());
    }
    map.on("zoomend", handleZoom);
    handleZoom();
    return () => map.off("zoomend", handleZoom);
  }, [map, setSearchRadius, setMapInstance]);
  return null;
}

function FitBoundsView({ markers }) {
  const map = useMap();
  const [hasFit, setHasFit] = useState(false);
  useEffect(() => {
    const savedZoom = sessionStorage.getItem("userMapZoom");
    if (!markers?.length || markers.length < 2 || hasFit || savedZoom) return;
    const bounds = L.latLngBounds(markers);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    setHasFit(true);
  }, [map, markers, hasFit]);
  return null;
}

function formatTime(timeStr) {
  if (!timeStr || timeStr.length !== 4) return "Invalid";
  const hours = timeStr.slice(0, 2);
  const minutes = timeStr.slice(2);
  return `${hours}:${minutes}`;
}

// Leaflet default icon fix + custom restaurant icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const restaurantIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/1046/1046784.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  shadowSize: [41, 41],
  shadowAnchor: [13, 41],
});


export default function HomeTab({
  userLatLng,
  filteredRestaurants = [],
  searchTerm,
  setSearchTerm,
  filters,
  setFilters,
  clearTypes,
  toggleType,
  searchRadius,
  currentDateTime,
  navigate,
  setMapInstance,
  setSearchRadius,
}) {
  const shouldFitBounds = filteredRestaurants.length > 0;
  const resultLabel = `${filteredRestaurants.length} ${
    filteredRestaurants.length === 1 ? "result" : "results"
  }`;

  const markers = useMemo(
    () => [
      userLatLng,
      ...filteredRestaurants
        .filter((r) => r?.location?.latitude && r?.location?.longitude)
        .map((r) => [r.location.latitude, r.location.longitude]),
    ],
    [userLatLng, filteredRestaurants]
  );

  return (
    <>
      <div className="sticky top-0 z-10 bg-white/80 rounded-md p-4 shadow-sm mb-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1 flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or address…"
                className="w-full pl-10 pr-3 py-2 rounded-md border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <svg
                className="absolute left-3 bottom-2.5 w-5 h-5 text-gray-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z"
                />
              </svg>
            </div>

            <div className="inline-flex items-center gap-2 shrink-0">
              <label className="text-sm font-medium text-gray-600 whitespace-nowrap m-0">
                Sort by:
              </label>
              <select
                id="sortBy"
                value={filters.sort}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, sort: e.target.value }))
                }
                className="border rounded-md py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="distance">Distance</option>
                <option value="rating">Rating</option>
                <option value="name">Name (A→Z)</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Availability
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={filters.openNow}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, openNow: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Open now
              </label>
            </div>
          </div>

          <div
            className="flex-none w-28 text-right text-sm text-gray-500 self-end tabular-nums select-none"
            aria-live="polite"
          >
            {resultLabel}
          </div>
        </div>

        {filters.types.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {filters.types.map((t) => (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className="px-2.5 py-1 rounded-full border text-xs bg-blue-50 border-blue-200 text-blue-700 cursor-pointer"
                title="Remove filter"
              >
                {t} ×
              </button>
            ))}
            <button
              onClick={clearTypes}
              className="text-xs text-blue-700 hover:underline cursor-pointer"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm mt-4 mb-4">
        <div className="h-72 md:h-80 lg:h-96 relative">
          <MapContainer
            center={userLatLng}
            zoom={parseInt(sessionStorage.getItem("userMapZoom")) || 11}
            scrollWheelZoom={false}
            style={{ height: "100%", width: "100%", zIndex: 0 }}
          >
            <MapSetTo position={userLatLng} />
            <ZoomToRadius
              setSearchRadius={setSearchRadius}
              setMapInstance={setMapInstance}
            />
            {shouldFitBounds && <FitBoundsView markers={markers} />}

            <TileLayer
              attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <Marker position={userLatLng}>
              <Popup>Your delivery location</Popup>
            </Marker>

            {userLatLng && (
              <>
                <Circle
                  center={userLatLng}
                  radius={searchRadius * 1000}
                  pathOptions={{
                    color: "#3b82f6",
                    fillColor: "#3b82f6",
                    fillOpacity: 0.08,
                  }}
                  weight={2}
                />
                <CircleMarker
                  center={userLatLng}
                  radius={5}
                  pathOptions={{
                    color: "#2563eb",
                    fillColor: "#2563eb",
                    fillOpacity: 1,
                  }}
                />
              </>
            )}

            {filteredRestaurants
              .filter((r) => r?.location?.latitude && r?.location?.longitude)
              .map((r) => (
                <Marker
                  key={r.id}
                  position={[r.location.latitude, r.location.longitude]}
                  icon={restaurantIcon}
                >
                  <Popup>
                    {r.storeName}
                    <br />
                    {r.address}
                    <br />
                    {typeof r.distance === "number"
                      ? `${r.distance.toFixed(2)} km away`
                      : ""}
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
        </div>
      </div>

      {/* Results */}
      <h2 className="mt-8 text-xl">
        Nearby Restaurants within {searchRadius} km
      </h2>

      {filteredRestaurants.length === 0 ? (
        <p className="mt-4 text-sm text-gray-600 italic">
          No restaurants match your filters.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredRestaurants.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                const encodedName = encodeURIComponent(r.storeName);
                const encodedId = encodeURIComponent(r.restaurantId);
                navigate(`/user/${encodedName}/${encodedId}/order`, {
                  state: { restaurant: r },
                });
              }}
              className="text-left border rounded-lg shadow-sm bg-white hover:shadow-md transition p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <h4 className="font-semibold">
                  {r.storeName}
                  <span className="ml-2 text-sm text-gray-600">
                    {typeof r.distance === "number"
                      ? `— ${r.distance.toFixed(2)} km`
                      : "— Location missing"}
                  </span>
                </h4>
                <span className="shrink-0 text-sm font-medium">
                  {r.rating ?? "N/A"}★
                </span>
              </div>

              <p className="mt-1 text-sm text-gray-700">{r.address}</p>

              {r.hours && (
                <p className="mt-2 font-medium">
                  {/* OPEN / CLOSED STATUS */}
                  <span
                    className={`text-sm ${
                      isRestaurantOpenToday(r.hours, currentDateTime)
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {isRestaurantOpenToday(r.hours, currentDateTime)
                      ? "Open"
                      : "Closed"}
                  </span>

                  {/* HOURS RANGE */}
                  <span className="ml-2 text-sm text-gray-500">
                    {(() => {
                      const dayName = new Date().toLocaleDateString("en-US", {
                        weekday: "long",
                      });
                      const todayHours = r.hours.find((entry) => entry[dayName]);
                      if (!todayHours) return "(No hours set)";
                      const opening = todayHours[dayName].Opening;
                      const closing = todayHours[dayName].Closing;
                      return `(${formatTime(opening)} - ${formatTime(closing)})`;
                    })()}
                  </span>

                  {/* AUTOSETTING STATUS */}
                  {!isRestaurantAcceptingOrders(r.autoSetting) && (
                    <span className="ml-2 text-red-600 text-sm font-medium">
                      — Currently not accepting orders
                    </span>
                  )}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
