// HomeTab.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  Polyline,
} from "react-leaflet";
import L from "leaflet";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import { Circle, CircleMarker } from "react-leaflet";
import { isRestaurantOpenToday } from "../../utils/isRestaurantOpenToday.js";
import { isRestaurantAcceptingOrders } from "../../utils/isRestaurantAcceptingOrders.js";
import { getBannerUrl } from "../../utils/getBannerUrl.js";
import { stringToColor } from "../../utils/stringToColor.js";

import RestaurantCardSkeleton from "../RestaurantCardSkeleton.jsx";

const db = getFirestore(); // Get firestore instance for db interactions

// Function to generate a custom L.divIcon with a colored border
const createBorderedRestaurantIcon = (orderId) => {
  const borderColor = stringToColor(orderId);
  const html = `
        <div style="
            width: 40px; 
            height: 40px;
            border: 4px solid ${borderColor}; 
            border-radius: 50%;
            background-color: transparent; 
            box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
        ">
            <img 
                src="https://cdn-icons-png.flaticon.com/512/1046/1046784.png" 
                style="width: 32px; height: 32px; border-radius: 50%;"
            />
        </div>
    `;

  const size = 40;
  const borderThickness = 4;

  return L.divIcon({
    html: html,
    className: "custom-restaurant-marker",
    iconSize: [size, size],
    iconAnchor: [16 + borderThickness, 32 + borderThickness],
    popupAnchor: [0, -size],
  });
};

// Function that saves routes from OSRM to firestore
function saveRouteToOrder({ restaurantId, orderId, routeType, coordinates }) {
  if (!restaurantId || !orderId || !Array.isArray(coordinates)) return;

  const orderRef = doc(
    db,
    "restaurants",
    restaurantId,
    "restaurantOrders",
    orderId
  );

  // Normalize leaflet's { lat, long } to firestore schema { Latitude, Longitude }
  const normalized = coordinates.map((c) => ({
    latitude: c.lat,
    longitude: c.lng,
  }));

  const field =
    routeType === "toRestaurant" ? "routeToRestaurant" : "routeToUser";

  return updateDoc(orderRef, {
    [field]: normalized,
  });
}

/** --- OrderDeliveryPath - Road-following routes + live courier dot ---
 * Subscribes to live courier locations, computes OSRM routes if missing from firestore, renders the route polyline and courier dot on the map
 */
function OrderDeliveryPath({ activeOrders, userLatLng }) {
  const [liveCourierLocations, setLiveCourierLocations] = useState({});
  const map = useMap();
  const routingControlsRef = useRef({});

  // Orders that have a courier assigned + confirmed
  const confirmedOrders = useMemo(() => {
    return Object.values(activeOrders)
      .flat()
      .filter(
        (order) =>
          order.courierConfirmed === true &&
          order.courierId &&
          order.restaurantLocation &&
          order.courierLocation
      );
  }, [activeOrders]);

  /** useEffect that subscribes to live courier location updates for all confirmed orders
   * When confirmedOrders changes:
   *   - A firestore onSnapshot listener is attached for each courierId
   *   - The latest {lat, long} is stored in liveCourierLocations
   *   - All listeners are unsubscribed on cleanup
   */
  useEffect(() => {
    // reset map of listeners
    const unsubscribes = [];

    confirmedOrders.forEach((order) => {
      if (!order.courierId) return;

      const courierRef = doc(db, "couriers", order.courierId);

      const unsub = onSnapshot(
        courierRef,
        (snap) => {
          const data = snap.data();
          if (data?.location?.latitude && data?.location?.longitude) {
            setLiveCourierLocations((prev) => ({
              ...prev,
              [order.courierId]: {
                latitude: data.location.latitude,
                longitude: data.location.longitude,
              },
            }));
          }
        },
        (err) => console.error("Live courier listener error:", err)
      );

      unsubscribes.push(unsub);
    });

    return () => unsubscribes.forEach((u) => u());
  }, [confirmedOrders]);

  /** useEffect that builds OSRM routes for confirmed orders and persists them to Firestore.
   *   - Clears existing routing controls from the map
   *   - For each confirmed order:
   *        Skip OSRM if the appropriate route is already stored
   *        Otherwise, call OSRM to compute courier to restaurant or courier to user
   *        When route is found, save it to Firestore
   *   - Cleans up all routing controls when dependencies change or component unmounts
   */
  useEffect(() => {
    if (!map) return;
    if (!userLatLng) return;

    // Clean up any existing routing controls
    Object.values(routingControlsRef.current).forEach((ctrl) => {
      try {
        map.removeControl(ctrl);
      } catch (e) {
        console.warn("Failed to remove routing control", e);
      }
    });
    routingControlsRef.current = {};

    // For each confirmed order, either build route or skip OSRM if route exists
    confirmedOrders.forEach((order) => {
      const restaurantLoc = order.restaurantLocation;
      const initialCourierLoc = order.courierLocation;

      // Both courier and restaurant coordinates are required to build a route
      if (
        !initialCourierLoc?.latitude ||
        !initialCourierLoc?.longitude ||
        !restaurantLoc?.latitude ||
        !restaurantLoc?.longitude
      ) {
        return;
      }

      const pathColor = stringToColor(order.orderId);

      const hasRouteToRestaurant =
        Array.isArray(order.routeToRestaurant) &&
        order.routeToRestaurant.length > 1;
      const hasRouteToUser =
        Array.isArray(order.routeToUser) && order.routeToUser.length > 1;

      // If we already have a stored route, don't call OSRM
      if (!order.courierPickedUp && hasRouteToRestaurant) {
        return;
      }
      if (order.courierPickedUp && hasRouteToUser) {
        return;
      }

      // Else, compute the missing leg via OSRM
      const courierLatLng = L.latLng(
        initialCourierLoc.latitude,
        initialCourierLoc.longitude
      );
      const restaurantLatLng = L.latLng(
        restaurantLoc.latitude,
        restaurantLoc.longitude
      );
      const userLatLngLL = L.latLng(userLatLng[0], userLatLng[1]);

      const waypoints = order.courierPickedUp
        ? [courierLatLng, userLatLngLL] // after pickup: courier to user
        : [courierLatLng, restaurantLatLng]; // before pickup: courier to restaurant

      const control = L.Routing.control({
        waypoints,
        router: L.Routing.osrmv1({
          serviceUrl: "https://router.project-osrm.org/route/v1",
        }),
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: false,
        show: false,
        lineOptions: {
          styles: [
            {
              color: pathColor,
              weight: 2,
              opacity: 0.8,
            },
          ],
        },
        createMarker: () => null,
      })
        .on("routesfound", async (e) => {
          try {
            const route = e.routes[0];
            const coords = route.coordinates;

            await saveRouteToOrder({
              restaurantId: order.restaurantId,
              orderId: order.orderId,
              routeType: order.courierPickedUp ? "toUser" : "toRestaurant",
              coordinates: coords,
            });
          } catch (err) {
            console.error("Failed to save route to Firestore:", err);
          }
        })
        .on("routingerror", (err) => {
          console.warn("OSRM routing error in HomeTab:", err);
        })
        .addTo(map);

      routingControlsRef.current[order.orderId] = control;
    });

    // Remove all routing controls from the map on cleanup
    return () => {
      Object.values(routingControlsRef.current).forEach((ctrl) => {
        try {
          map.removeControl(ctrl);
        } catch (e) {
          console.warn("Failed to remove routing control", e);
        }
      });
      routingControlsRef.current = {};
    };
  }, [map, confirmedOrders, userLatLng]);

  // Render stored OSRM routes and live courier dot
  return (
    <>
      {confirmedOrders.map((order) => {
        const pathColor = stringToColor(order.orderId);

        // Draw stored route if available
        let routeCoords = null;
        if (
          !order.courierPickedUp &&
          Array.isArray(order.routeToRestaurant) &&
          order.routeToRestaurant.length > 1
        ) {
          routeCoords = order.routeToRestaurant.map((p) => [
            p.latitude,
            p.longitude,
          ]);
        } else if (
          order.courierPickedUp &&
          Array.isArray(order.routeToUser) &&
          order.routeToUser.length > 1
        ) {
          routeCoords = order.routeToUser.map((p) => [p.latitude, p.longitude]);
        }

        return (
          <React.Fragment key={order.orderId}>
            {(() => {
              if (!routeCoords) return null;

              const liveLocation =
                liveCourierLocations[order.courierId] || order.courierLocation;

              // If we don't know where the courier is, draw full route
              if (!liveLocation?.latitude || !liveLocation?.longitude) {
                return (
                  <Polyline
                    positions={routeCoords}
                    pathOptions={{
                      color: pathColor,
                      weight: 2,
                      opacity: 0.9,
                    }}
                  />
                );
              }

              // Find the closest point on the route to the courier
              let closestIndex = 0;
              let closestDistSq = Infinity;

              routeCoords.forEach(([lat, lng], idx) => {
                const dLat = lat - liveLocation.latitude;
                const dLng = lng - liveLocation.longitude;
                const distSq = dLat * dLat + dLng * dLng;

                if (distSq < closestDistSq) {
                  closestDistSq = distSq;
                  closestIndex = idx;
                }
              });

              // Slice route so everything behind the courier is removed
              const futureRoute = routeCoords.slice(closestIndex);

              return (
                <Polyline
                  positions={futureRoute}
                  pathOptions={{
                    color: pathColor,
                    weight: 2,
                    opacity: 0.9,
                  }}
                />
              );
            })()}

            {/* Draw live courier dot */}
            {(() => {
              const liveLocation =
                liveCourierLocations[order.courierId] || order.courierLocation;
              if (!liveLocation?.latitude || !liveLocation?.longitude) {
                return null;
              }
              const courierCoords = [
                liveLocation.latitude,
                liveLocation.longitude,
              ];
              return (
                <CircleMarker
                  center={courierCoords}
                  radius={3}
                  pathOptions={{
                    color: pathColor,
                    fillColor: pathColor,
                    fillOpacity: 1,
                    weight: 1,
                  }}
                />
              );
            })()}
          </React.Fragment>
        );
      })}
    </>
  );
}

// Function that keeps the map centered on a provided position and respects a locally stored zoom level
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

// Function that converts a zoom level to a search radius in km
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

/** Function that observes zoom changes on the map and:
 *   - Converts zoom level to search radius
 *   - Updates search radius state
 *   - Stores zoom level in local storage
 */
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

/** Function that fits the map view to contain all markers as long as:
 *   - There are are least two markers present
 *   - There is no lcoally saved zoom level
 *   - The map hasn't been initialized
 */
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

// Leaflet default icon fix and custom restaurant icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Default restuarant icon for restuarants with no active orders
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

/**
 * Main UserPage tab that shows:
 *   - The map with user location, radius, restaurants, and active deliveries
 *   - A list of restaurants that match current filters & radius
 *
 * Props:
 *   - userLatLng: [lat, lng]
 *   - filteredRestaurants: Restaurant[] (after search, type filters, radius)
 *   - restaurantsWithActiveOrders: { [restaurantId: string]: Order[] }
 *   - searchTerm, setSearchTerm: search text + setter
 *   - filters, setFilters, clearTypes, toggleType: filter controls
 *   - searchRadius: current radius in km (derived from map zoom)
 *   - currentDateTime: Date or timestamp for open/closed calculations
 *   - navigate: from react-router, used to open restaurant order pages
 *   - setMapInstance: callback to give parent the Leaflet map
 *   - setSearchRadius: set radius when zoom changes
 */
export default function HomeTab({
  userLatLng,
  filteredRestaurants = [],
  restaurantsWithActiveOrders = {},
  searchTerm,
  filters,
  searchRadius,
  currentDateTime,
  navigate,
  setMapInstance,
  setSearchRadius,
}) {
  const BATCH_SIZE = 10;

  // How many restaurants are currently visible in the list (used for infinite scroll effect)
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  // DOM ref (used for infinite scroll effect)
  const loadMoreRef = useRef(null);

  // Reset visibleCount when filters or search change
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [filteredRestaurants, searchTerm, filters]);

  // Slice filteredRestaurants so it only shows visibleCount entries
  const visibleRestaurants = useMemo(
    () => filteredRestaurants.slice(0, visibleCount),
    [filteredRestaurants, visibleCount]
  );

  // Restaurants to show on the map = filtered ones and any with active orders
  const restaurantsOnMap = useMemo(() => {
    const byId = new Map();

    // Start with filtered restaurants (distance and filters)
    filteredRestaurants.forEach((r) => {
      if (!r?.id) return;
      byId.set(r.id, r);
    });

    // Add restaurants that have active orders (even if they're not in filteredRestaurants)
    Object.entries(restaurantsWithActiveOrders || {}).forEach(
      ([restaurantId, orders]) => {
        if (!orders || orders.length === 0) return;
        if (byId.has(restaurantId)) return;

        const firstOrder = orders[0];

        // Use location from order if restaurant not already in filtered list
        const loc = firstOrder.restaurantLocation;
        if (!loc?.latitude || !loc?.longitude) return;

        byId.set(restaurantId, {
          id: restaurantId,
          restaurantId: restaurantId,
          storeName: firstOrder.restaurantName || "Active order restaurant",
          address: firstOrder.restaurantAddress || "",
          location: {
            latitude: loc.latitude,
            longitude: loc.longitude,
          },
          // flag so we can show a note in popup (future)
          _outsideRadius: true,
        });
      }
    );

    return Array.from(byId.values());
  }, [filteredRestaurants, restaurantsWithActiveOrders]);

  const shouldFitBounds = filteredRestaurants.length > 0;

  // Markers used for initial fitBounds (user and all restaurantsOnMap)
  const markers = useMemo(
    () => [
      userLatLng,
      ...restaurantsOnMap
        .filter((r) => r?.location?.latitude && r?.location?.longitude)
        .map((r) => [r.location.latitude, r.location.longitude]),
    ],
    [userLatLng, restaurantsOnMap]
  );

  // Used to show skeleton cards while loading
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current) return;
    if (filteredRestaurants.length <= visibleCount) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (entry.isIntersecting && !isLoadingMore) {
          setIsLoadingMore(true);

          setTimeout(() => {
            setVisibleCount((prev) =>
              Math.min(prev + BATCH_SIZE, filteredRestaurants.length)
            );
            setIsLoadingMore(false);
          }, 600); // artificial network delay to show skeletons
        }
      },
      {
        root: null,
        rootMargin: "0px",
        threshold: 1.0,
      }
    );

    const el = loadMoreRef.current;
    observer.observe(el);

    return () => {
      observer.unobserve(el);
    };
  }, [filteredRestaurants.length, visibleCount, isLoadingMore]);

  // Render homeTab components
  return (
    <>
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

            {/* Delivery routes and live courier marker */}
            <OrderDeliveryPath
              activeOrders={restaurantsWithActiveOrders}
              userLatLng={userLatLng}
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

            {restaurantsOnMap
              .filter((r) => r?.location?.latitude && r?.location?.longitude)
              .map((r) => {
                const activeOrders = restaurantsWithActiveOrders[r.id];
                let iconToUse = restaurantIcon;

                if (activeOrders && activeOrders.length > 0) {
                  const firstActiveOrderId = activeOrders[0].orderId;
                  iconToUse = createBorderedRestaurantIcon(firstActiveOrderId);
                }

                return (
                  <Marker
                    key={r.id}
                    position={[r.location.latitude, r.location.longitude]}
                    icon={iconToUse}
                  >
                    <Popup>
                      <div className="font-semibold mb-1">{r.storeName}</div>
                      <div>{r.address}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        {typeof r.distance === "number"
                          ? `${r.distance.toFixed(2)} km away`
                          : r._outsideRadius
                          ? "Outside current search radius"
                          : ""}
                      </div>

                      {activeOrders && activeOrders.length > 0 && (
                        <div className="mt-2 text-sm font-medium text-green-700">
                          {activeOrders.length} Active Order
                          {activeOrders.length > 1 ? "s" : ""}
                        </div>
                      )}

                      {r._outsideRadius && !activeOrders && (
                        <div className="mt-1 text-xs text-gray-500">
                          (Shown because of previous activity)
                        </div>
                      )}
                    </Popup>
                  </Marker>
                );
              })}
          </MapContainer>
        </div>
      </div>
      <h2 className="mt-8 text-xl">
        Nearby Restaurants within {searchRadius} km
      </h2>

      {visibleRestaurants.length === 0 ? (
        <p className="mt-4 text-sm text-gray-600 italic">
          No restaurants match your filters.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch auto-rows-fr">
          {visibleRestaurants.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                const encodedName = encodeURIComponent(r.storeName);
                const encodedId = encodeURIComponent(r.restaurantId);
                navigate(`/user/${encodedName}/${encodedId}/order`, {
                  state: { restaurant: r },
                });
              }}
              className="flex flex-col h-full text-left border rounded-lg shadow-sm bg-white hover:shadow-md transition focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer overflow-hidden"
            >
              <div className="relative w-full aspect-[5/1] bg-gray-100 overflow-hidden">
                {getBannerUrl(r) ? (
                  <img
                    src={getBannerUrl(r)}
                    alt={`${r.storeName} banner`}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(135deg, ${stringToColor(
                        r.storeName
                      )} 0%, #2563EB 100%)`,
                    }}
                  ></div>
                )}
              </div>

              <div className="flex-1 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-semibold leading-snug">
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
                      <span className="ml-2 text-sm text-gray-500">
                        {(() => {
                          const dayName = new Date().toLocaleDateString(
                            "en-US",
                            {
                              weekday: "long",
                            }
                          );
                          const todayHours = r.hours.find(
                            (entry) => entry[dayName]
                          );
                          if (!todayHours) return "(No hours set)";
                          const opening = todayHours[dayName].Opening;
                          const closing = todayHours[dayName].Closing;
                          return `(${opening.slice(0, 2)}:${opening.slice(
                            2
                          )} - ${closing.slice(0, 2)}:${closing.slice(2)})`;
                        })()}
                      </span>
                      {!isRestaurantAcceptingOrders(r.autoSetting) && (
                        <span className="ml-2 text-red-600 text-sm font-medium">
                          — Currently not accepting orders
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
          {isLoadingMore &&
            Array.from({ length: 4 }).map((_, idx) => (
              <RestaurantCardSkeleton key={`skeleton-${idx}`} />
            ))}
        </div>
      )}
      {visibleRestaurants.length < filteredRestaurants.length && (
        <div
          ref={loadMoreRef}
          className="py-4 text-center text-sm text-gray-500"
        ></div>
      )}
    </>
  );
}
