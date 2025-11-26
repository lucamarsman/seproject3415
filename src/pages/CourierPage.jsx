import { useEffect, useState, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Navigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  doc,
  updateDoc,
  query,
  where,
  collection,
  onSnapshot,
  getDocs,
  GeoPoint,
  writeBatch,
  addDoc,
  increment,
  Timestamp,
} from "firebase/firestore";
import { coordinateFormat } from "../utils/coordinateFormat";
import { calculateEtaCourier } from "../utils/calculateEtaCourier";

// Simple runtime guard so UI does not fully crash
const safeWrap = (fn) => {
  try {
    fn();
  } catch (err) {
    console.error("Runtime error in CourierPage:", err);
  }
};

/**
 * Haversine distance in meters between two { latitude, longitude } coordinates
 * Used for movement analysis and route simulator distance calculations
 */
const metersBetween = (a, b) => {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;

  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
};

// Max distance allowed between courier and restaurant to accept a task
const MAX_ACCEPT_DISTANCE_METERS = 10000;

// Dev simulator origin point (Harman's house)
const SIM_ORIGIN = { latitude: 44.356118, longitude: -79.627597 };

/**
 * Calls the public OSRM API to get a driving route between two coordinate points.
 * Returns an array of { latitude, longitude }.
 */
async function fetchOsrmRoute(from, to) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${from.longitude},${from.latitude};` +
    `${to.longitude},${to.latitude}` +
    `?overview=full&geometries=geojson`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OSRM HTTP ${res.status}`);
  }
  const data = await res.json();

  if (!data.routes || !data.routes[0]) {
    throw new Error(data.code || "No route");
  }

  const coords = data.routes[0].geometry.coordinates;
  return coords.map(([lng, lat]) => ({
    latitude: lat,
    longitude: lng,
  }));
}

/**
 * Get or create route for a given task leg:
 *  - "toRestaurant": SIM_ORIGIN -> restaurant
 *  - "toUser": restaurant -> user
 *
 * Uses Firestore fields:
 *  - routeToRestaurant
 *  - routeToUser
 *
 * If OSRM fails, falls back to a straight line [from, to].
 */
async function getOrCreateRouteForTaskLeg(task, leg) {
  const field = leg === "toUser" ? "routeToUser" : "routeToRestaurant";

  // Use stored route if it exists
  if (Array.isArray(task[field]) && task[field].length > 1) {
    return task[field].map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
    }));
  }

  const restaurantLoc = coordinateFormat(task.restaurantLocation);
  const userLoc = coordinateFormat(task.userLocation);

  if (
    !restaurantLoc ||
    typeof restaurantLoc.latitude !== "number" ||
    typeof restaurantLoc.longitude !== "number"
  ) {
    throw new Error("Invalid restaurantLocation for OSRM route");
  }

  let from, to;

  if (leg === "toRestaurant") {
    // SIM_ORIGIN -> restaurant
    from = SIM_ORIGIN;
    to = restaurantLoc;
  } else {
    // restaurant -> user
    if (
      !userLoc ||
      typeof userLoc.latitude !== "number" ||
      typeof userLoc.longitude !== "number"
    ) {
      throw new Error("Invalid userLocation for OSRM route");
    }
    from = restaurantLoc;
    to = userLoc;
  }

  let route = null;

  try {
    // Try to fetch a real driving route from OSRM between from -> to
    route = await fetchOsrmRoute(from, to);
    if (!route || route.length < 2) {
      throw new Error("OSRM route too short");
    }
  } catch (err) {
    console.warn(
      `OSRM failed for leg ${leg}, falling back to straight line:`,
      err
    );
    // Fallback: simple straight line between from/to
    route = [from, to];
  }

  // Save back to Firestore for reuse
  try {
    const orderRef = doc(
      db,
      "restaurants",
      task.restaurantId,
      "restaurantOrders",
      task.orderId
    );
    await updateDoc(orderRef, {
      [field]: route,
    });
  } catch (err) {
    console.warn(
      "Failed to persist fallback/OSRM route to Firestore (using in-memory anyway):",
      err
    );
  }

  return route;
}

/**
 * CourierPage - main dashboard for delivery couriers:
 *  - Authenticates user and links them to a couriers doc (and creates one if needed)
 *  - Tracks courier location (real GPS / dev simulator) and:
 *       - Updates Firestore with location, status, and a throttled movementFlag
 *       - Derives movement phase and basic metrics (speed, ETA, distances)
 *  - Manages the current task:
 *       - Listens to the assigned order in restaurantOrders
 *       - Supports pickup confirmation and delivery confirmation
 *       - Updates ETA and deliveryStatus after pickup
 *  - Lists available tasks:
 *       - Subscribes to all open and unassigned orders across restaurants
 *       - Sorts by earliest prep time and shortest total_Distance
 *       - Enforces a max accept distance (unless simulator is used)
 *  - Uses OSRM routes:
 *       - Computes and persists routeToRestaurant / routeToUser per order
 *       - Drives the dev GPS simulator along those stored routes
 */
export default function CourierPage() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [courierData, setCourierData] = useState(null);
  const [fetchingCourier, setFetchingCourier] = useState(true);
  const [error, setError] = useState("");
  const [setLocationAccessDenied] = useState(false);
  const [orders, setOrders] = useState([]);
  const [fetchingOrders, setFetchingOrders] = useState(true);
  const [currentTask, setCurrentTask] = useState(null);

  const courierDataRef = useRef(courierData);
  const currentTaskRef = useRef(currentTask);

  const lastGPSRef = useRef(null);
  const movementRef = useRef({ lastMoveTime: 0 });

  // Stores a movement state for the courier
  const movementStateRef = useRef("IDLE"); // IDLE | MOVING | NEAR_DESTINATION | STOPPED_TOO_LONG

  // Throttler: Stores timestamp of last Firestore location write
  const lastUpdateTimeRef = useRef(0);

  // Route-based simulator refs
  const simRouteRef = useRef(null);
  const simRouteIndexRef = useRef(0);
  const simSegmentFracRef = useRef(0);

  // UI movement meta: status text, ETA, last GPS update, etc.
  const [movementMeta, setMovementMeta] = useState({
    lastUpdate: null,
    gpsAccuracy: null,
    speedKmh: null,
    phase: "Idle",
    etaMinutes: null,
    distToRestaurantKm: null,
    distToUserKm: null,
  });

  // Simple simulator for devs - follows the stored route
  const [simulator, setSimulator] = useState({
    enabled: true, // dev: turn off in production
    running: false,
    speedKmh: 30,
    stepMs: 1000,
    origin: SIM_ORIGIN,
    target: null,
  });

  const simulatorIntervalRef = useRef(null);
  const simulatorSpeedRef = useRef(30);

  useEffect(() => {
    simulatorSpeedRef.current = simulator.speedKmh;
  }, [simulator.speedKmh]);

  // Helper function to log and store movement state when it changes
  const updateMovementState = (newState) => {
    if (movementStateRef.current !== newState) {
      movementStateRef.current = newState;
      console.log("Movement state changed →", newState);
    }
  };

  // Keep refs in sync with state so async logic uses the latest
  useEffect(() => {
    courierDataRef.current = courierData;
  }, [courierData]);

  useEffect(() => {
    currentTaskRef.current = currentTask;
  }, [currentTask]);

  const CURRENT_TIME_MS = Date.now();

  // Helper function to format order timestamps
  const formatOrderTimestamp = (timestamp) => {
    return timestamp?.toDate ? timestamp.toDate().toLocaleString() : "N/A";
  };

  // Function that determines if a given orderTime is still in the future relative to currentTime
  const isOnTime = (currentTime, orderTime) => {
    if (!orderTime || typeof orderTime.seconds !== "number") return false;
    const orderTimeMs =
      orderTime.seconds * 1000 + orderTime.nanoseconds / 1000000;
    return currentTime <= orderTimeMs;
  };

  // Helper function to update courier status in Firestore and state
  const updateCourierDoc = async (updates) => {
    const currentCourierId = courierDataRef.current?.id;
    if (!currentCourierId) return;

    if (updates.location) {
      updates.location = new GeoPoint(
        updates.location.latitude,
        updates.location.longitude
      );
    }

    const courierDocRef = doc(db, "couriers", currentCourierId);
    try {
      await updateDoc(courierDocRef, updates);
      setCourierData((prev) => ({ ...prev, ...updates }));
    } catch (err) {
      console.error("Failed to update courier document:", err);
      if (updates.status) {
        setError(`Failed to update status to ${updates.status}.`);
      }
    }
  };

  // Helper function that returns a user-friendly location error message based on code
  const getLocationErrorMessage = (code) => {
    switch (code) {
      case 1:
        return "Location access was denied. Please enable location services to continue.";
      case 2:
        return "Location information is unavailable. Check your device settings.";
      case 3:
        return "Location request timed out. Try again with a stronger signal.";
      default:
        return "Unable to access location.";
    }
  };

  // Firebase auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoadingAuth(false);
    });
    return unsubscribe;
  }, []);

  // Login or create user
  useEffect(() => {
    if (!user) return;

    const couriersRef = collection(db, "couriers");

    const fetchOrCreateCourier = async () => {
      try {
        const q = query(couriersRef, where("email", "==", user.email));
        const snapshot = await getDocs(q);

        // Existing courier found
        if (!snapshot.empty) {
          const matchedDoc = snapshot.docs[0];
          setCourierData({ id: matchedDoc.id, ...matchedDoc.data() });
          setFetchingCourier(false);
          return;
        }

        // No existing courier found
        if (!navigator.geolocation) {
          setError(
            "Location services are unavailable on your device. Please enable location access to resume courier capabilities."
          );
          setFetchingCourier(false);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude, accuracy } = position.coords;

            const newCourier = {
              email: user.email,
              name: user.displayName || user.email,
              earnings: 0,
              location: new GeoPoint(latitude, longitude),
              movementFlag: "inactive",
              status: "inactive",
            };

            const docRef = await addDoc(couriersRef, newCourier);
            await updateDoc(docRef, { courierId: docRef.id });

            setCourierData({
              id: docRef.id,
              courierId: docRef.id,
              ...newCourier,
            });

            setMovementMeta((prev) => ({
              ...prev,
              lastUpdate: Date.now(),
              gpsAccuracy: accuracy ?? null,
              phase: "Idle",
            }));

            setFetchingCourier(false);
          },
          (err) => {
            console.error("Location error", err);
            const message = getLocationErrorMessage(err.code);
            setError(message);

            if (err.code === 1) {
              setLocationAccessDenied(true);
            }

            setFetchingCourier(false);
          }
        );
      } catch (err) {
        console.error("Error fetching or creating courier:", err);
        setError("Something went wrong.");
        setFetchingCourier(false);
      }
    };

    fetchOrCreateCourier();
  }, [user]);

  /**
   * Updates currentTask’s ETA once the courier has picked up the order.
   * Writes into the order doc (and local state) using calculateEtaCourier.
   */
  const updateCourierTask = async (latestFormattedLocation) => {
    const task = currentTaskRef.current;
    const courier = courierDataRef.current;

    const courierLocation = latestFormattedLocation;

    if (!task || !courier || !courierLocation || task.orderCompleted) {
      return;
    }

    const userLoc = task.userLocation;
    const now = new Date();

    const formattedCourierLoc = courierLocation;
    const formattedUserLoc = coordinateFormat(userLoc);

    const locationValid =
      formattedCourierLoc &&
      typeof formattedCourierLoc.latitude === "number" &&
      typeof formattedCourierLoc.longitude === "number" &&
      formattedUserLoc &&
      typeof formattedUserLoc.latitude === "number" &&
      typeof formattedUserLoc.longitude === "number";

    if (!locationValid) {
      console.warn(
        `Location data invalid for task ${task.orderId}. Cannot calculate ETA.`
      );
      return;
    }

    let updates = {};

    // Only update ETA once the order is picked up from restaurant
    if (task.courierPickedUp) {
      updates = calculateEtaCourier(formattedCourierLoc, formattedUserLoc, now);
      updates.deliveryStatus = "Delivery enroute.";
      updates.courierLocation = formattedCourierLoc;
      updates.courier_R_Distance = 0;
      updates.courier_R_EtaMinutes = 0;

      const orderDocRef = doc(
        db,
        "restaurants",
        task.restaurantId,
        "restaurantOrders",
        task.orderId
      );

      try {
        await updateDoc(orderDocRef, updates);

        setCurrentTask((prev) => ({
          ...prev,
          ...updates,
          estimatedDeliveryTime: updates.estimatedDeliveryTime,
        }));
      } catch (err) {
        console.error(`Failed to update task ${task.orderId} ETA:`, err);
        setError("Failed to update task ETA.");
      }
    }
  };

  // GPS Throttling, Movement Analysis & Location Update
  useEffect(() => {
    if (simulator.enabled) return; // Skip real GPS when simulator is enabled
    if (!navigator.geolocation || !courierData?.id) return;

    const watcher = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const now = Date.now();
        const newLoc = { latitude, longitude };

        const last = lastGPSRef.current;

        let moved = 0;
        if (last && typeof last.latitude === "number") {
          moved = metersBetween(last, newLoc);

          // Very small movement -> treat as potential stop, don't spam updates
          if (moved < 1) {
            const stoppedFor = now - (movementRef.current.lastMoveTime || now);
            if (stoppedFor > 120000) {
              updateMovementState("STOPPED_TOO_LONG");
              updateCourierDoc({ movementFlag: movementStateRef.current });
            }

            setMovementMeta((prev) => ({
              ...prev,
              lastUpdate: now,
              gpsAccuracy: accuracy ?? prev.gpsAccuracy,
            }));

            return;
          }

          movementRef.current.lastMoveTime = now;
        } else {
          movementRef.current.lastMoveTime = now;
        }

        // Smart Task Phase & Distance Computation
        const task = currentTaskRef.current;
        let phaseLabel = "Available";
        let distToRestaurantMeters = null;
        let distToUserMeters = null;

        if (task) {
          try {
            // Distance to restaurant
            if (task.restaurantLocation) {
              const restLoc = coordinateFormat(task.restaurantLocation);
              if (
                restLoc &&
                typeof restLoc.latitude === "number" &&
                typeof restLoc.longitude === "number"
              ) {
                distToRestaurantMeters = metersBetween(newLoc, restLoc);
              }
            }

            // Distance to user
            if (task.userLocation) {
              const userLoc = coordinateFormat(task.userLocation);
              if (
                userLoc &&
                typeof userLoc.latitude === "number" &&
                typeof userLoc.longitude === "number"
              ) {
                distToUserMeters = metersBetween(newLoc, userLoc);
              }
            }

            if (!task.courierPickedUp) {
              // Before pickup
              if (
                typeof distToRestaurantMeters === "number" &&
                distToRestaurantMeters < 60
              ) {
                phaseLabel = "Arrived at restaurant";
                updateMovementState("NEAR_DESTINATION");
              } else if (
                typeof distToRestaurantMeters === "number" &&
                distToRestaurantMeters < 5000
              ) {
                phaseLabel = "Heading to restaurant";
                updateMovementState("MOVING");
              } else {
                phaseLabel = "Travelling";
              }
            } else {
              // After pickup
              if (
                typeof distToUserMeters === "number" &&
                distToUserMeters < 40
              ) {
                phaseLabel = "Arrived near customer";
                updateMovementState("NEAR_DESTINATION");
              } else if (
                typeof distToUserMeters === "number" &&
                distToUserMeters < 5000
              ) {
                phaseLabel = "Delivering order";
                updateMovementState("MOVING");
              } else {
                phaseLabel = "On delivery route";
              }
            }
          } catch (e) {
            console.warn("Movement analysis error:", e);
          }
        } else {
          phaseLabel = "Available for tasks";
          updateMovementState("IDLE");
        }

        // Cache latest GPS with timestamp
        lastGPSRef.current = { ...newLoc, timestamp: now };

        // Throttle Firestore updates to ~1.5s minimum interval
        const sinceLastUpdate = now - (lastUpdateTimeRef.current || 0);
        if (sinceLastUpdate < 1500) {
          const distUserKm =
            typeof distToUserMeters === "number"
              ? distToUserMeters / 1000
              : null;
          const distRestKm =
            typeof distToRestaurantMeters === "number"
              ? distToRestaurantMeters / 1000
              : null;

          let speedKmh = null;
          if (last && last.timestamp && moved > 0) {
            const dtSec = (now - last.timestamp) / 1000;
            if (dtSec > 0.5) {
              speedKmh = Math.round((moved / 1000 / dtSec) * 3600);
            }
          }

          let etaMinutes = null;
          if (task && task.courierPickedUp && distToUserMeters != null) {
            const distKm = distToUserMeters / 1000;
            const assumedSpeed = 30;
            etaMinutes = Math.max(1, Math.round((distKm / assumedSpeed) * 60));
          }

          setMovementMeta((prev) => ({
            ...prev,
            lastUpdate: now,
            gpsAccuracy: accuracy ?? prev.gpsAccuracy,
            speedKmh,
            phase: phaseLabel,
            etaMinutes,
            distToRestaurantKm: distRestKm,
            distToUserKm: distUserKm,
          }));

          return;
        }
        lastUpdateTimeRef.current = now;

        // Derive a simple courier status from movement state
        let nextStatus = "active";
        if (
          movementStateRef.current === "STOPPED_TOO_LONG" ||
          movementStateRef.current === "IDLE"
        ) {
          nextStatus = "inactive";
        }

        // Push updated location, movement state & status to Firestore
        updateCourierDoc({
          location: newLoc,
          movementFlag: movementStateRef.current,
          status: nextStatus,
        });

        // Update task ETA (Firestore) if applicable
        updateCourierTask(newLoc);

        const distUserKm =
          typeof distToUserMeters === "number" ? distToUserMeters / 1000 : null;
        const distRestKm =
          typeof distToRestaurantMeters === "number"
            ? distToRestaurantMeters / 1000
            : null;

        let speedKmh = null;
        if (last && last.timestamp && moved > 0) {
          const dtSec = (now - last.timestamp) / 1000;
          if (dtSec > 0.5) {
            speedKmh = Math.round((moved / 1000 / dtSec) * 3600);
          }
        }

        let etaMinutes = null;
        if (task && task.courierPickedUp && distToUserMeters != null) {
          const distKm = distToUserMeters / 1000;
          const assumedSpeed = 30;
          etaMinutes = Math.max(1, Math.round((distKm / assumedSpeed) * 60));
        }

        setMovementMeta((prev) => ({
          ...prev,
          lastUpdate: now,
          gpsAccuracy: accuracy ?? prev.gpsAccuracy,
          speedKmh,
          phase: phaseLabel,
          etaMinutes,
          distToRestaurantKm: distRestKm,
          distToUserKm: distUserKm,
        }));
      },
      (err) => {
        console.warn("GPS error:", err);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watcher);
  }, [courierData?.id, simulator.enabled]);

  // Route-based Simulator GPS effect
  useEffect(() => {
    if (!simulator.enabled || !simulator.running) return;
    if (!courierData?.id) return;

    if (simulatorIntervalRef.current) {
      clearInterval(simulatorIntervalRef.current);
    }

    simulatorIntervalRef.current = setInterval(() => {
      safeWrap(async () => {
        const route = simRouteRef.current;
        const task = currentTaskRef.current;

        if (!route || route.length < 2) {
          console.warn("Simulator has no valid route - stopping.");
          setSimulator((p) => ({ ...p, running: false }));
          return;
        }

        let idx = simRouteIndexRef.current || 0;
        let frac = simSegmentFracRef.current || 0;

        const end = route[route.length - 1];

        // Arrival at final point
        if (idx >= route.length - 1) {
          const pos = { ...end, timestamp: Date.now() };
          lastGPSRef.current = pos;

          updateMovementState("NEAR_DESTINATION");
          await updateCourierDoc({
            location: pos,
            movementFlag: "NEAR_DESTINATION",
            status: "active",
          });
          await updateCourierTask(pos);

          setMovementMeta((prev) => ({
            ...prev,
            lastUpdate: Date.now(),
            speedKmh: 0,
            etaMinutes: 0,
            phase: task?.courierPickedUp
              ? "Sim · Arrived near customer"
              : "Sim · Arrived at restaurant",
          }));

          setSimulator((p) => ({ ...p, running: false }));
          return;
        }

        // Metric movement logic along route
        const speedKmh = simulator.speedKmh || 30;
        const mps = (speedKmh * 1000) / 3600;
        const dt = simulator.stepMs / 1000;
        let moveMeters = mps * dt;

        // Segment skipping - move across multiple segments if needed
        while (moveMeters > 0 && idx < route.length - 1) {
          const A = route[idx];
          const B = route[idx + 1];
          const segmentMeters = metersBetween(A, B);

          const distRemaining = segmentMeters * (1 - frac);

          if (moveMeters < distRemaining) {
            frac += moveMeters / segmentMeters;
            moveMeters = 0;
          } else {
            moveMeters -= distRemaining;
            idx++;
            frac = 0;

            if (idx >= route.length - 1) break;
          }
        }

        simRouteIndexRef.current = idx;
        simSegmentFracRef.current = frac;

        // Interpolate current simulated position
        const A = route[idx];
        const B = route[Math.min(idx + 1, route.length - 1)];

        const lat = A.latitude + (B.latitude - A.latitude) * frac;
        const lng = A.longitude + (B.longitude - A.longitude) * frac;

        const newPos = { latitude: lat, longitude: lng, timestamp: Date.now() };

        lastGPSRef.current = newPos;
        updateMovementState(
          idx >= route.length - 1 ? "NEAR_DESTINATION" : "MOVING"
        );

        await updateCourierDoc({
          location: newPos,
          movementFlag: idx >= route.length - 1 ? "NEAR_DESTINATION" : "MOVING",
          status: "active",
        });

        await updateCourierTask(newPos);

        // Remaining distance to end of route (for ETA)
        let remMeters = 0;
        if (idx < route.length - 1) {
          for (let i = idx; i < route.length - 1; i++) {
            remMeters += metersBetween(route[i], route[i + 1]);
          }
          const segMeters = metersBetween(A, B);
          remMeters -= segMeters * frac;
        }

        const remKm = remMeters / 1000;
        const etaMinutes =
          speedKmh > 0
            ? Math.max(1, Math.round((remKm / speedKmh) * 60))
            : null;

        setMovementMeta((prev) => ({
          ...prev,
          lastUpdate: Date.now(),
          speedKmh,
          etaMinutes,
          distToRestaurantKm:
            task && !task.courierPickedUp ? remKm : prev.distToRestaurantKm,
          distToUserKm:
            task && task.courierPickedUp ? remKm : prev.distToUserKm,
          phase: task
            ? task.courierPickedUp
              ? "Sim · Delivering"
              : "Sim · Heading to restaurant"
            : "Sim · Moving",
        }));
      });
    }, simulator.stepMs);

    return () => {
      if (simulatorIntervalRef.current) {
        clearInterval(simulatorIntervalRef.current);
        simulatorIntervalRef.current = null;
      }
    };
  }, [
    simulator.enabled,
    simulator.running,
    simulator.speedKmh,
    simulator.stepMs,
    courierData?.id,
  ]);

  /* REALTIME COURIER LISTENER (Phase 1) */
  useEffect(() => {
    if (!courierData?.id) return;
    const ref = doc(db, "couriers", courierData.id);

    const unsub = onSnapshot(ref, (snap) => {
      safeWrap(() => {
        if (snap.exists()) {
          setCourierData((prev) => ({ ...prev, ...snap.data() }));
        }
      });
    });
    return () => unsub();
  }, [courierData?.id]);

  /* REALTIME TASK LISTENER (Phase 2) */
  useEffect(() => {
    if (!courierData?.currentTask) {
      setCurrentTask(null);
      return;
    }
    const { currentTask: taskId, currentRestaurant: restId } = courierData;
    if (!taskId || !restId) return;

    const ref = doc(db, "restaurants", restId, "restaurantOrders", taskId);
    const unsub = onSnapshot(ref, (snap) => {
      safeWrap(() => {
        if (snap.exists()) {
          setCurrentTask({ orderId: snap.id, ...snap.data() });
        }
      });
    });
    return () => unsub();
  }, [courierData?.currentTask]);

  /* REALTIME AVAILABLE ORDERS LISTENER (Phase 3) */

  // Stores unsubscribe functions for each restaurant’s orders listener
  const [restaurantListeners, setRestaurantListeners] = useState([]);

  useEffect(() => {
    async function setupListeners() {
      restaurantListeners.forEach((unsub) => unsub());
      const restaurantsSnap = await getDocs(collection(db, "restaurants"));
      const newListeners = [];

      restaurantsSnap.forEach((rest) => {
        const ordersRef = collection(
          db,
          "restaurants",
          rest.id,
          "restaurantOrders"
        );
        const q = query(
          ordersRef,
          where("orderConfirmed", "==", true),
          where("orderCompleted", "==", false),
          where("courierId", "==", "")
        );

        const unsub = onSnapshot(q, (snap) => {
          safeWrap(() => {
            const list = [];
            snap.forEach((o) =>
              list.push({ orderId: o.id, restaurantId: rest.id, ...o.data() })
            );

            setOrders((prev) => {
              const map = new Map();

              // Keep existing orders from other restaurants
              prev.forEach((o) => {
                if (o.restaurantId !== rest.id) {
                  map.set(`${o.restaurantId}__${o.orderId}`, o);
                }
              });

              // Add/replace orders for this restaurant
              list.forEach((o) => {
                map.set(`${o.restaurantId}__${o.orderId}`, o);
              });

              return Array.from(map.values());
            });
          });
        });

        newListeners.push(unsub);
      });

      setRestaurantListeners(newListeners);
      setFetchingOrders(false);
    }

    setupListeners();
    return () => restaurantListeners.forEach((unsub) => unsub());
  }, [courierData?.id]);

  // handleAccept
  const handleAccept = async (order) => {
    // Require courier to be near the restaurant before accepting the task
    if (
      !simulator.enabled &&
      courierData?.location &&
      order?.restaurantLocation
    ) {
      try {
        const courierLoc = {
          latitude: courierData.location.latitude,
          longitude: courierData.location.longitude,
        };
        const restLoc = coordinateFormat(order.restaurantLocation);

        if (
          restLoc &&
          typeof restLoc.latitude === "number" &&
          typeof restLoc.longitude === "number"
        ) {
          const dist = metersBetween(courierLoc, restLoc);
          if (dist > MAX_ACCEPT_DISTANCE_METERS) {
            alert(
              "You are too far from this restaurant to accept this delivery. Move closer and try again."
            );
            return;
          }
        }
      } catch (e) {
        console.warn("Distance check failed, allowing accept as fallback:", e);
      }
    }

    // Optional: vibrate on accept (mobile UX)
    if ("vibrate" in navigator) {
      navigator.vibrate([120, 80, 120]);
    }

    try {
      const orderDocRef = doc(
        db,
        "restaurants",
        order.restaurantId,
        "restaurantOrders",
        order.orderId
      );
      const courierDocRef = doc(db, "couriers", courierData.id);

      const batch = writeBatch(db);

      batch.update(orderDocRef, {
        courierConfirmed: true,
        courierId: courierData.courierId,
      });

      batch.update(courierDocRef, {
        currentTask: order.orderId,
        currentRestaurant: order.restaurantId,
      });

      await batch.commit();

      const newTask = {
        ...order,
        orderId: order.orderId,
        restaurantId: order.restaurantId,
        courierId: courierData.courierId,
      };
      setCurrentTask(newTask);
      setOrders((prev) => prev.filter((o) => o.orderId !== order.orderId));

      // Precompute routeToRestaurant so HomeTab + simulator can reuse it
      try {
        await getOrCreateRouteForTaskLeg(newTask, "toRestaurant");
      } catch (e) {
        console.warn("Could not precompute routeToRestaurant at accept:", e);
      }

      // Auto-start simulator along route from SIM_ORIGIN -> restaurant (dev only)
      if (simulator.enabled) {
        try {
          const route = await getOrCreateRouteForTaskLeg(
            newTask,
            "toRestaurant"
          );
          if (!route || route.length < 2) {
            console.warn(
              "Route for sim (toRestaurant) is too short, not starting sim."
            );
            return;
          }

          simRouteRef.current = route;
          simRouteIndexRef.current = 0;

          const first = route[0];
          lastGPSRef.current = { ...first, timestamp: Date.now() };

          await updateCourierDoc({
            location: first,
            movementFlag: "MOVING",
            status: "active",
          });

          setSimulator((prev) => ({
            ...prev,
            running: true,
          }));
        } catch (e) {
          console.error("Failed to start sim to restaurant:", e);
        }
      }
    } catch (err) {
      console.error("Error accepting order:", err);
      setError("Failed to accept order.");
    }
  };

  const handlePickupOrder = async (orderId) => {
    if (!orderId || !courierData?.id) return;

    const task = currentTaskRef.current;
    if (!task || task.orderId !== orderId) {
      console.error("Task not found or mismatch for orderId:", orderId);
      alert("Current task data is missing or mismatched.");
      return;
    }

    if (task.courierPickedUp) {
      return;
    }

    if (
      !window.confirm(
        "Confirm that you have picked up this order from the restaurant?"
      )
    ) {
      return;
    }

    try {
      const orderRef = doc(
        db,
        "restaurants",
        task.restaurantId,
        "restaurantOrders",
        orderId
      );

      const updates = {
        courierPickedUp: true,
        deliveryStatus: "Courier picked up. En route to customer.",
      };

      await updateDoc(orderRef, updates);

      const updatedTask = { ...task, ...updates };
      setCurrentTask((prev) =>
        prev && prev.orderId === orderId ? updatedTask : prev
      );

      // If simulator is enabled, retarget via routeToUser
      if (simulator.enabled && updatedTask.userLocation) {
        try {
          const route = await getOrCreateRouteForTaskLeg(
            { ...updatedTask },
            "toUser"
          );
          if (!route || route.length < 2) {
            console.warn(
              "Route for sim (toUser) is too short, not starting sim."
            );
            return;
          }

          simRouteRef.current = route;
          simRouteIndexRef.current = 0;

          const origin = route[0];
          lastGPSRef.current = { ...origin, timestamp: Date.now() };

          await updateCourierDoc({
            location: origin,
            movementFlag: "MOVING",
            status: "active",
          });

          setSimulator((prev) => ({
            ...prev,
            running: true,
          }));
        } catch (e) {
          console.warn("Failed to start sim to user after pickup:", e);
        }
      }
    } catch (err) {
      console.error("Failed to mark order as picked up:", err);
      setError("Failed to mark order as picked up.");
    }
  };

  // FUNCTION: Formats the order items into a message on delivery by courier
  const formatItemsForMessage = (items) => {
    if (!Array.isArray(items) || items.length === 0) return "your order items";
    const formattedItems = items
      .map((item) => {
        const hasMods = Array.isArray(item.selectedMods) && item.selectedMods.length > 0;
        let modString = "";
        if (hasMods) {
          const modNames = item.selectedMods.map(mod => mod.name).join(', ');
          modString = ` (${modNames})`;
        }
        return `${item.quantity}x ${item.name}${modString}`;
      })
      .join(", ");
    return formattedItems;
  };

  const handleUserExchange = async (orderId) => {
    if (!orderId || !courierData?.id) return;

    const task = currentTaskRef.current;
    if (!task || task.orderId !== orderId) {
      console.error("Task not found or mismatch for orderId:", orderId);
      alert("Current task data is missing or mismatched.");
      return;
    }

    if (
      !window.confirm(
        "Confirm that the Grab N Go user's orderId matches your task orderId?"
      )
    ) {
      return;
    }

    try {
      const batch = writeBatch(db);

      const orderRef = doc(
        db,
        "restaurants",
        task.restaurantId,
        "restaurantOrders",
        orderId
      );
      const courierRef = doc(db, "couriers", courierData.id);
      const userRef = collection(db, "users", task.userId, "messages");
      const systemRef = doc(db, "systemFiles", "systemVariables");

      const paymentCourier = Number(task.paymentCourier) || 0;
      const paymentPlatform = Number(task.paymentPlatform) || 0;

      batch.update(orderRef, {
        deliveryStatus: "Delivery complete.",
        orderCompleted: true,
        completedBy: courierData.id,
        completedAt: Timestamp.fromDate(new Date()),
      });

      batch.update(courierRef, {
        currentTask: "",
        currentRestaurant: "",
        earnings: increment(paymentCourier),
      });

      // Send message to customer
      await addDoc(userRef, {
        createdAt: Timestamp.fromDate(new Date()),
        message: `Order ${orderId} from ${
          task.storeName
        } , containing ${formatItemsForMessage(
          task.items
        )}, has been delivered. 
            Total paid: $${Number(task.payment).toFixed(
              2
            )}. Thank you for choosing Grab N Go.`,
        read: false,
        type: "order_status",
        orderId: orderId,
      });

      batch.update(systemRef, {
        earnings: increment(paymentPlatform),
      });

      await batch.commit();

      setCurrentTask(null);
      // Update the local state view
      setCourierData((prev) => ({
        ...prev,
        currentTask: "",
        currentRestaurant: "",
      }));

      setSimulator((prev) => ({
        ...prev,
        running: false,
        target: null,
      }));

      simRouteRef.current = null;
      simRouteIndexRef.current = 0;
      lastGPSRef.current = null;

      console.log(
        `Order ${orderId} successfully marked as complete and courier earnings updated.`
      );
    } catch (error) {
      console.error("Error updating order status upon user delivery:", error);
      alert("Failed to update order status. Check console for details.");
    }
  };

  if (loadingAuth) return <div>Loading authentication...</div>;
  if (!user) return <Navigate to="/login" />;

  // COMPONENT UI
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">
          Welcome, {user.displayName || user.email}{" "}
          <span className="text-sm font-normal text-gray-500">
            · Courier Dashboard
          </span>
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-700">
          {movementMeta.phase && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-400 mr-2" />
              {movementMeta.phase}
            </span>
          )}

          {movementMeta.etaMinutes && currentTask && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">
              ETA: ~{movementMeta.etaMinutes} min
            </span>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-gray-500">
            <span>
              Last GPS update:{" "}
              {movementMeta.lastUpdate
                ? new Date(movementMeta.lastUpdate).toLocaleTimeString()
                : "—"}
            </span>
            {movementMeta.speedKmh != null && (
              <span>
                · Approx. speed:{" "}
                <span className="font-medium">
                  {movementMeta.speedKmh} km/h
                </span>
              </span>
            )}
            {movementMeta.gpsAccuracy != null && (
              <span>· GPS ±{Math.round(movementMeta.gpsAccuracy)} m</span>
            )}
          </div>
        </div>
      </header>

      {error && (
        <p className="mb-4 text-sm bg-red-50 text-red-700 border border-red-100 px-3 py-2 rounded">
          {error}
        </p>
      )}

      {fetchingCourier ? (
        <p className="mt-4">Checking your courier profile...</p>
      ) : courierData ? (
        <>
          {/* Simulator panel (dev only) */}
          <section className="mb-6 border rounded-lg bg-slate-50/60 p-4 text-xs text-gray-700">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">
                  Simulator (dev)
                </h2>
                <p className="text-[11px] text-gray-500">
                  Simulates GPS along the stored OSRM route. Turn off when using
                  a real device.
                </p>
              </div>
              <label className="flex items-center gap-2 text-[11px]">
                <span>Enable</span>
                <input
                  type="checkbox"
                  checked={simulator.enabled}
                  onChange={(e) =>
                    setSimulator((prev) => ({
                      ...prev,
                      enabled: e.target.checked,
                      running: e.target.checked ? prev.running : false,
                    }))
                  }
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-2">
              <div className="flex items-center gap-2">
                <span>Speed</span>
                <input
                  type="number"
                  min={5}
                  max={800}
                  value={simulator.speedKmh}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    simulatorSpeedRef.current = val;
                    setSimulator((prev) => ({
                      ...prev,
                      speedKmh: val,
                    }));
                  }}
                  className="w-16 border rounded px-1 py-0.5 text-xs"
                />
                <span>km/h</span>
              </div>

              <button
                type="button"
                className="px-3 py-1 rounded bg-sky-600 text-white text-xs font-medium hover:bg-sky-700 disabled:opacity-40"
                disabled={!simulator.enabled || !currentTask}
                onClick={async () => {
                  const task = currentTaskRef.current;
                  if (!task) return;

                  const leg = task.courierPickedUp ? "toUser" : "toRestaurant";

                  try {
                    const route = await getOrCreateRouteForTaskLeg(
                      { ...task },
                      leg
                    );
                    if (!route || route.length < 2) {
                      alert("Route has too few points to simulate.");
                      return;
                    }

                    simRouteRef.current = route;
                    simRouteIndexRef.current = 0;

                    const first = route[0];
                    lastGPSRef.current = { ...first, timestamp: Date.now() };

                    await updateCourierDoc({
                      location: first,
                      movementFlag: "MOVING",
                      status: "active",
                    });

                    setSimulator((prev) => ({
                      ...prev,
                      running: true,
                    }));
                  } catch (e) {
                    console.error("Failed to start sim for current leg:", e);
                    alert(
                      `Failed to get route: ${e.message || "Unknown error"}`
                    );
                  }
                }}
              >
                Start sim for current leg
              </button>

              {simulator.running && (
                <button
                  type="button"
                  className="px-3 py-1 rounded bg-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-300"
                  onClick={() =>
                    setSimulator((prev) => ({ ...prev, running: false }))
                  }
                >
                  Stop sim
                </button>
              )}

              <span className="text-[11px] text-gray-500">
                Status:{" "}
                {simulator.enabled
                  ? simulator.running
                    ? "Running"
                    : "Idle"
                  : "Disabled"}
              </span>
            </div>
          </section>

          {/* Courier Info + Stats */}
          <section className="mb-8 grid md:grid-cols-2 gap-4">
            <div className="border rounded-lg bg-white shadow-sm">
              <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg">
                <h2 className="text-sm font-semibold text-gray-800">
                  Courier Profile
                </h2>
              </div>
              <div className="p-4 text-sm text-gray-700">
                <div className="flex flex-col gap-2">
                  <div>
                    <span className="font-medium text-gray-600">
                      Courier ID:
                    </span>{" "}
                    <span className="font-mono">
                      {courierData.courierId || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Name:</span>{" "}
                    {courierData.name || "—"}
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Email:</span>{" "}
                    {courierData.email || "—"}
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Earnings:</span>{" "}
                    <span className="font-semibold text-emerald-700">
                      ${(courierData.earnings ?? 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border rounded-lg bg-white shadow-sm">
              <div className="px-4 py-3 border-b bg-gray-50 rounded-t-lg">
                <h2 className="text-sm font-semibold text-gray-800">
                  Live Location Snapshot
                </h2>
              </div>
              <div className="p-4 text-sm text-gray-700 space-y-1">
                <div>
                  <span className="font-medium text-gray-600">Coords:</span>{" "}
                  {courierData.location ? (
                    <>
                      {courierData.location.latitude.toFixed(6)},{" "}
                      {courierData.location.longitude.toFixed(6)}
                    </>
                  ) : (
                    "Not available"
                  )}
                </div>
                <div>
                  <span className="font-medium text-gray-600">
                    Movement flag:
                  </span>{" "}
                  {courierData.movementFlag || "—"}
                </div>
                <div>
                  <span className="font-medium text-gray-600">GPS status:</span>{" "}
                  {courierData.status || "—"}
                </div>
                {movementMeta.distToRestaurantKm != null && currentTask && (
                  <div>
                    <span className="font-medium text-gray-600">
                      Dist. to restaurant:
                    </span>{" "}
                    {movementMeta.distToRestaurantKm.toFixed(2)} km
                  </div>
                )}
                {movementMeta.distToUserKm != null && currentTask && (
                  <div>
                    <span className="font-medium text-gray-600">
                      Dist. to customer:
                    </span>{" "}
                    {movementMeta.distToUserKm.toFixed(2)} km
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Current Task */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">Current Task</h2>
            {fetchingOrders ? (
              <p>Loading tasks…</p>
            ) : currentTask ? (
              <section className="mb-8">
                <div className="p-4 border rounded shadow-md bg-white">
                  {/* Task phase & ETA chips */}
                  <div className="flex flex-wrap items-center gap-3 mb-3 text-xs">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-50 text-slate-700 font-medium">
                      <span className="w-2 h-2 rounded-full bg-slate-400 mr-2" />
                      Task Phase: {movementMeta.phase || "In progress"}
                    </span>
                    {movementMeta.etaMinutes && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                        ETA: ~{movementMeta.etaMinutes} min
                      </span>
                    )}
                  </div>

                  {/* Table for Key Metrics */}
                  <table className="w-full text-sm mb-3">
                    <thead className="border-b bg-gray-50">
                      <tr>
                        <th className="py-2 px-2 text-left">Order ID</th>
                        <th className="py-2 px-2 text-left">Payout</th>
                        <th className="py-2 px-2 text-left">
                          Restaurant Distance:{" "}
                          <span className="font-normal">
                            {currentTask.restaurantAddress}
                          </span>
                        </th>
                        <th className="py-2 px-2 text-left">
                          Total Trip:{" "}
                          <span className="font-normal">
                            {currentTask.userAddress}
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-1 px-2 font-semibold">
                          {currentTask.orderId}
                        </td>
                        <td className="py-1 px-2 font-semibold text-green-600">
                          ${Number(currentTask.paymentCourier ?? 0).toFixed(2)}
                        </td>
                        <td className="py-1 px-2">
                          {currentTask.courier_R_Distance}km
                        </td>
                        <td className="py-1 px-2">
                          {currentTask.courierPickedUp
                            ? currentTask.courier_U_Distance
                            : currentTask.total_Distance}
                          km
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Items List */}
                  <strong className="block text-sm mb-1 text-gray-900">
                    Items:
                  </strong>
                  <ul className="ml-4 list-disc text-xs space-y-0.5">
                    {currentTask.items?.map((item, i) => (
                      <li key={i}>
                        {item.name} × {item.quantity}
                      </li>
                    ))}
                  </ul>

                  {/* Action Buttons */}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {!currentTask.courierPickedUp && (
                      <button
                        onClick={() => handlePickupOrder(currentTask.orderId)}
                        className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition duration-150 ease-in-out"
                      >
                        Mark as Picked Up
                      </button>
                    )}

                    {currentTask.courierPickedUp && (
                      <button
                        onClick={() => handleUserExchange(currentTask.orderId)}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out"
                      >
                        Confirm Delivery
                      </button>
                    )}
                  </div>
                </div>
              </section>
            ) : (
              <p>No current tasks.</p>
            )}
          </section>

          {/* CONDITIONAL RENDERING: Only show Task List if there is NO currentTask */}
          {!currentTask && (
            <>
              <hr className="my-8 border-t-2 border-gray-300" />
              <h2 className="text-xl font-semibold mb-4">Available Tasks</h2>
              {fetchingOrders ? (
                <p>Loading tasks…</p>
              ) : orders.length === 0 ? (
                <p>No tasks available.</p>
              ) : (
                <ul className="list-none space-y-4 text-gray-700">
                  {orders
                    .slice()
                    .sort((a, b) => {
                      // 1. Order by earliest prep time
                      const timeA = a.estimatedPreppedTime?.seconds || 0;
                      const timeB = b.estimatedPreppedTime?.seconds || 0;
                      const timeComparison = timeA - timeB;
                      if (timeComparison !== 0) return timeComparison;

                      // 2. Order by shortest total_Distance first
                      return (a.total_Distance || 0) - (b.total_Distance || 0);
                    })
                    .map((order, idx) => (
                      <li
                        key={`${order.restaurantId}__${order.orderId}__${idx}`}
                        className="p-4 border rounded shadow-md bg-white"
                      >
                        <table className="w-full text-sm mb-3">
                          <thead className="border-b bg-gray-50">
                            <tr>
                              <th className="py-2 px-2 text-left">Order ID</th>
                              <th className="py-2 px-2 text-left">Payout</th>
                              <th className="py-2 px-2 text-left">Ready At</th>
                              <th className="py-2 px-2 text-left">
                                Restaurant Distance:{" "}
                                <span className="font-normal">
                                  {order.restaurantAddress}
                                </span>
                              </th>
                              <th className="py-2 px-2 text-left">
                                Total Trip:{" "}
                                <span className="font-normal">
                                  {order.userAddress}
                                </span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="py-1 px-2 font-semibold">
                                {order.orderId}
                              </td>
                              <td className="py-1 px-2 font-semibold">
                                ${Number(order.paymentCourier ?? 0).toFixed(2)}
                              </td>
                              <td
                                className={`text-sm ${
                                  isOnTime(
                                    CURRENT_TIME_MS,
                                    order.estimatedPreppedTime
                                  )
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {formatOrderTimestamp(
                                  order.estimatedPreppedTime
                                )}
                              </td>
                              <td className="py-1 px-2">
                                {order.courier_R_Distance}km
                              </td>
                              <td className="py-1 px-2">
                                {order.total_Distance}km
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Items List */}
                        <strong className="block text-sm mb-1 text-gray-900">
                          Items:
                        </strong>
                        <ul className="ml-4 list-disc text-xs space-y-0.5">
                          {order.items?.map((item, i) => (
                            <li key={i}>
                              {item.name} × {item.quantity}
                            </li>
                          ))}
                        </ul>

                        {/* Action Button */}
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                          <button
                            className="bg-green-600 text-white px-4 py-2 rounded-md shadow hover:bg-green-700 transition text-sm font-medium"
                            onClick={() => handleAccept(order)}
                          >
                            Accept Task
                          </button>
                          <span className="text-xs text-gray-500">
                            Restaurant: {order.storeName || order.restaurantId}
                          </span>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

/*
TODO
* Later: courier must be within a certain distance to accept a task (currently 10km; can tighten to 3km)
* Later: Better UI -> top right nav is CourierPage user profile link (Name, email, phone* Please complete your user profile before continuing)
                      Job disclosure form: standard procedures/rules - gps tracking; click deliveryStatus buttons; 
                      obligation to select movementFlag updates if waiting; add phoneNumber field
* Later: inactivityTimer: initially set to 0; increases if gps value does not change by a significant amount
* Later: movementFlag: initially set to inactive; set to inactive if inactivityTimer > threshold (10min)

* Advanced: couriers with multiple tasks are possible [2 people in same area, around same time, order from the same McDonalds]; task gen function in systemFiles restaurant orders

Cases: 
1. status = inactive &                                  currentTask = empty  -> currentTasks are unavailable to be added
2. status = inactive &                                  currentTask = filled -> admin will contact (by email and phone number)
3. status = active   & movementFlag = inactive        & currentTask = filled -> admin will contact (by email and phone number)
4. status = active   & movementFlag = need assistance & currentTask = filled -> admin will contact (by email and phone number)

* admin (bot) will reassign the task to restaurant orders, if the current courier (2) has it, and does not respond after msg 
* admin (bot) will reassign the task to restaurant orders, if the current courier (3) has it, and does not respond after msg 
* admin (bot) will create a special assistance task to restaurant orders, if the courier (4) asks for assistance

# Assumes GPS is always dynamic, gps and movement is always tracked
*/
