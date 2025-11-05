import { useEffect, useState, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Navigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  GeoPoint,
  Timestamp,
  doc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { updateOrderToRejected } from "../utils/updateOrderToRejected.js";
import { geocodeAddress } from "../utils/geocodeAddress.js";
import { getDistanceInKm } from "../utils/getDistanceInKm.js";

import Sidebar from "../components/RestaurantPage/sidebar";
import OrdersTab from "../components/RestaurantPage/ordersTab";
import OrderHistoryTab from "../components/RestaurantPage/orderHistoryTab";
import MenuTab from "../components/RestaurantPage/menuTab";
import SettingsTab from "../components/RestaurantPage/settingsTab";

function parseHoursArray(hoursArray) {
  const result = {};
  hoursArray.forEach((dayObj) => {
    const [day, times] = Object.entries(dayObj)[0];
    result[day] = times;
  });
  return result;
}

const phoneRegex = /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;

function formatHoursForFirestore(hoursObject) {
  return Object.entries(hoursObject).map(([day, times]) => ({
    [day]: times,
  }));
}

export default function RestaurantPage() {
  const [activeTab, setActiveTab] = useState("info");
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [restaurantData, setRestaurantData] = useState(null);
  const [fetchingRestaurant, setFetchingRestaurant] = useState(true);
  const [error, setError] = useState("");
  const [hoursState, setHoursState] = useState({});
  
  // For orders
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  // Dropdown options
  const [cuisineTypes, setCuisineTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [selectedType, setSelectedType] = useState("");
  const [settings, setSettings] = useState({
    autoSetting: "manual",
  });

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoadingAuth(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
      const fetchCuisineTypes = async () => {
          setLoadingTypes(true);
          try {
              const docRef = doc(db, "systemFiles", "systemVariables");
              const docSnap = await getDoc(docRef);

              if (docSnap.exists() && Array.isArray(docSnap.data().typeIcons)) {
                  const types = docSnap.data().typeIcons
                      .map(item => item.type)
                      .filter(type => type);

                  setCuisineTypes(types);
              } else {
                  console.warn("Cuisine types array not found or is invalid.");
              }
          } catch (error) {
              console.error("Error fetching cuisine types for dropdown:", error);
          } finally {
              setLoadingTypes(false);
          }
      };
      fetchCuisineTypes();
  }, []);


  useEffect(() => {
    if (!restaurantData) return;
    if (restaurantData.hours) {
        const parsed = parseHoursArray(restaurantData.hours);
        setHoursState(parsed);
    }
    if (restaurantData.type) {
        setSelectedType(restaurantData.type);
    } else if (cuisineTypes.length > 0) {
        setSelectedType(cuisineTypes[0]);
    }
  }, [restaurantData, cuisineTypes]);

  // Fetch or create restaurant based on logged-in user
  useEffect(() => {
    if (!user) return;

    const restaurantsRef = collection(db, "restaurants");

    const fetchOrCreate = async () => {
      try {
        const snapshot = await getDocs(restaurantsRef);
        const matchedDoc = snapshot.docs.find((docSnap) => {
          const data = docSnap.data();
          const emailMatch = data.email === user.email;
          const nameMatch =
            data.name?.toLowerCase().trim() ===
            user.displayName?.toLowerCase().trim();
          return emailMatch || nameMatch;
        });

        if (matchedDoc) {
          const data = matchedDoc.data();
          setRestaurantData({ id: matchedDoc.id, ...data });
          setSettings({
            autoSetting: data.autoSetting ?? "manual",
          });
          setFetchingRestaurant(false);
          return;
        }

        // No existing, create new restaurant
        const newRest = {
          address: "",
          autoSetting: "manual",
          createdAt: Timestamp.fromDate(new Date()),
          email: user.email,
          hours: [
            { Monday: { Opening: "0900", Closing: "1700" } },
            { Tuesday: { Opening: "0900", Closing: "1700" } },
            { Wednesday: { Opening: "0900", Closing: "1700" } },
            { Thursday: { Opening: "0900", Closing: "1700" } },
            { Friday: { Opening: "0900", Closing: "1700" } },
            { Saturday: { Opening: "0900", Closing: "1700" } },
            { Sunday: { Opening: "0900", Closing: "1700" } },
          ],
          location: new GeoPoint(0, 0),
          name: user.displayName,
          phone: "",
          rating: 0,
          storeName: "",
          totalOrders: 0,
          type: "",
        };

        const docRef = await addDoc(restaurantsRef, newRest);
        await updateDoc(docRef, { restaurantId: docRef.id });

        setRestaurantData({ id: docRef.id, restaurantId: docRef.id, ...newRest });
        setFetchingRestaurant(false);
      } catch (err) {
        console.error("Error in fetchOrCreate restaurant:", err);
        setError("Error setting up your restaurant info.");
        setFetchingRestaurant(false);
      }
    };

    fetchOrCreate();
  }, [user]);

  // --- Realtime listener for restaurantOrders (Initial load + updates)
  const ordersRef = useRef(orders); // Ref to hold the mutable 'orders' state

  useEffect(() => {
    // Update the ref whenever the 'orders' state changes
    ordersRef.current = orders; 
  }, [orders]); 

  // Realtime listener. UPDATES: orderConfirmed, estimatedPickUpTime, estimatedPreppedTime
  useEffect(() => {
    if (!restaurantData?.id) return;

    // GET ALL ORDERS IN RESTAURANT
    const ordersCollectionRef = collection(
        db,
        "restaurants",
        restaurantData.id,
        "restaurantOrders"
    );
    let firstLoad = true; 

    // PROCESSING FUNCTION
    const processOrders = async (ordersArray) => {
    // 1. COURIER TRACKING AND ETA CALCULATION
    const activeOrders = ordersArray.filter(
        (order) => 
            order.courierConfirmed === true && // Courier confirmed pickup
            order.courierId && // Courier is assigned
            order.restaurantLocation && // Must have restaurant location
            order.deliveryStatus !== "Delivered" && 
            order.deliveryStatus !== "Delivery enroute" 
    );

    if (activeOrders.length > 0) {
        const uniqueCourierIds = new Set(activeOrders.map(order => order.courierId));
        const courierDataMap = new Map();
        const updateBatch = writeBatch(db);
        const localUpdates = [];

        // Fetch all unique courier locations in parallel
        await Promise.all(
            Array.from(uniqueCourierIds).map(async (courierId) => {
                const courierDocRef = doc(db, "couriers", courierId); 
                try {
                    const courierSnap = await getDoc(courierDocRef);
                    if (courierSnap.exists()) {
                        courierDataMap.set(courierId, courierSnap.data());
                    }
                } catch (err) {
                    console.error(`Error fetching courier ${courierId}:`, err);
                }
            })
        );
        
        // Loop through active orders to calculate ETA
        for (const order of activeOrders) {
            const courier = courierDataMap.get(order.courierId);
            
            // --- Data Preparation and Validation ---
            
            const now = new Date();
            let preppedDate = null;
            let remainingPrepDurationMinutes = 0;

            if (order.estimatedPreppedTime && typeof order.estimatedPreppedTime.toDate === 'function') {
                preppedDate = order.estimatedPreppedTime.toDate();
                // Calculate the difference in milliseconds and convert to minutes
                remainingPrepDurationMinutes = Math.max(0, Math.round((preppedDate.getTime() - now.getTime()) / 60000));
            }

            const courierLoc = courier?.location;
            const restaurantLoc = order.restaurantLocation;
            const userLoc = order.userLocation;
            
            // Use safe access for coordinates in validation
            const locationValid = (
                courierLoc && typeof courierLoc._lat === 'number' && typeof courierLoc._long === 'number' &&
                restaurantLoc && typeof restaurantLoc._lat === 'number' && typeof restaurantLoc._long === 'number' &&
                userLoc && typeof userLoc.latitude === 'number' && typeof userLoc.longitude === 'number'
            );
            
            let C_R_distanceKm = 0;
            let R_U_distanceKm = 0;
            let courier_R_EtaMinutes = NaN;
            let courier_U_EtaMinutes = NaN;
            
            let estimatedPickUpTimeTimestamp = null;
            let estimatedDeliveryTimeTimestamp = null;
            let newDeliveryStatus;

            if (locationValid) {
                // 1. DISTANCE CALCULATION
                C_R_distanceKm = getDistanceInKm(courierLoc._lat, courierLoc._long, restaurantLoc._lat, restaurantLoc._long);
                R_U_distanceKm = getDistanceInKm(restaurantLoc._lat, restaurantLoc._long, userLoc.latitude, userLoc.longitude);

                // 2. COURIER ETA DURATION CALCULATION (from now)
                const COURIER_SPEED_KMH = 60;
                const R_travelTimeMinutes = (C_R_distanceKm / COURIER_SPEED_KMH) * 60;
                courier_R_EtaMinutes = Math.max(1, Math.round(R_travelTimeMinutes)); // Courier R_ETA Duration from now
                const U_travelTimeMinutes = (R_U_distanceKm / COURIER_SPEED_KMH) * 60;
                const R_U_courierTime = Math.max(1, Math.round(U_travelTimeMinutes)); // R -> U Travel Duration
                
                // 3. CALCULATE ESTIMATED PICKUP TIME (TIMESTAMP)
                const courierArrivalDate = new Date(now.getTime() + courier_R_EtaMinutes * 60000);
                let estimatedPickUpDate;
                if (courierArrivalDate.getTime() > preppedDate.getTime()) {
                    estimatedPickUpDate = courierArrivalDate;
                } else {
                    estimatedPickUpDate = preppedDate;
                }
                estimatedPickUpTimeTimestamp = Timestamp.fromDate(courierArrivalDate);

                // 4. CALCULATE ESTIMATED DELIVERY TIME (TIMESTAMP)
                const estimatedDeliveryDate = new Date(estimatedPickUpDate.getTime() + R_U_courierTime * 60000);
                estimatedDeliveryTimeTimestamp = Timestamp.fromDate(estimatedDeliveryDate);                
                courier_U_EtaMinutes = Math.round((estimatedDeliveryDate.getTime() - now.getTime()) / 60000);

                // 6. SIMPLIFIED STATUS MESSAGE
                console.log("Delivery Status updated");
                newDeliveryStatus = "Awaiting courier pick-up."
                /*
                newDeliveryStatus = `
                    Courier to Restaurant: **${C_R_distanceKm.toFixed(1)} km** (ETA: ${courier_R_EtaMinutes} min). 
                    Delivery to User: **${R_U_distanceKm.toFixed(1)} km**. Total ETA to User: **${courier_U_EtaMinutes} min**.
                    Food Ready Time (Remaining): **${remainingPrepDurationMinutes} min**.
                `;*/

            } else {
                // Fallback status if location data is incomplete
                newDeliveryStatus = `Courier assigned, but location data is temporarily unavailable. Food Ready Time (Remaining): **${remainingPrepDurationMinutes} min**.`;
                console.warn(`Location data invalid for order ${order.orderId}. Cannot calculate distance.`);
            }

            // Add update to the batch
            const orderRef = doc(
                db,
                "restaurants",
                restaurantData.id,
                "restaurantOrders",
                order.orderId
            );
            
            // Update the order document
            updateBatch.update(orderRef, {
                deliveryStatus: newDeliveryStatus,
                courier_R_Distance: C_R_distanceKm, 
                courier_R_EtaMinutes: courier_R_EtaMinutes,
                estimatedPickUpTime: estimatedPickUpTimeTimestamp, // Timestamp
                courier_U_Distance: R_U_distanceKm, 
                courier_U_EtaMinutes: courier_U_EtaMinutes,
                estimatedDeliveryTime: estimatedDeliveryTimeTimestamp, // Timestamp
                courierLat: courierLoc?._lat || null, 
                courierLng: courierLoc?._long || null, 
            });

            // Prepare local state update
            localUpdates.push({
                orderId: order.orderId,
                deliveryStatus: newDeliveryStatus,
            });
        }

        // Commit the batch updates to Firestore
        if (localUpdates.length > 0) {
            try {
                await updateBatch.commit();
                setOrders(prevOrders => prevOrders.map(order => {
                    const update = localUpdates.find(u => u.orderId === order.orderId);
                    return update ? { ...order, deliveryStatus: update.deliveryStatus } : order;
                }));
            } catch (error) {
                console.error("Batch ETA update failed:", error);
            }
        }
    }
    
    // --- 2. EXISTING TIMEOUT REJECTION LOGIC (unchanged) ---
    const now = new Date();
    const timedOutOrders = ordersArray.filter((order) => {
        const timeout = order.orderTimeout?.toDate?.() || (order.orderTimeout ? new Date(order.orderTimeout) : null);
        const shouldReject = timeout && order.orderConfirmed === null && timeout < now;
        if (shouldReject) {
            console.log(`!!! Order ${order.orderId} is TIMED OUT.`);
        }
        return shouldReject;
    });

    if (timedOutOrders.length === 0) return;

    // 1. Run the atomic update for all timed-out orders
    const rejectionResults = await Promise.all(
        timedOutOrders.map(order => updateOrderToRejected(restaurantData.id, order.orderId))
    );
    
    // 2. Update local state for all successful rejections
    const successfullyRejectedIds = timedOutOrders
        .filter((_, index) => rejectionResults[index].success)
        .map(order => order.orderId);

    if (successfullyRejectedIds.length > 0) {
        setOrders(prevOrders => {
            return prevOrders.map(order => {
                if (successfullyRejectedIds.includes(order.orderId)) {
                    console.log(`[Local Update] Rejected order ${order.orderId} status updated.`);
                    return {
                        ...order,
                        orderConfirmed: false,
                        deliveryStatus: "Auto-rejected: Order timed out."
                    };
                }
                return order;
            });
        });
    }
  };

    // 1️⃣ REAL-TIME LISTENER: Updates the UI/local state (setOrders) and manages loading
    const unsub = onSnapshot(
        ordersCollectionRef,
        (snapshot) => {
            const fetchedOrders = snapshot.docs.map((docSnap) => ({
                orderId: docSnap.id,
                ...docSnap.data(),
            }));
            
            // Update the state immediately on any Firestore change.
            setOrders(fetchedOrders);
            
            // Manage loading state ONLY here
            if (firstLoad) {
                setLoadingOrders(false);
                firstLoad = false;
            }
        },
        (error) => {
            console.error("Error listening to orders:", error);
            setError("Error fetching orders.");
            if (firstLoad) setLoadingOrders(false);
        }
    );

    // 2️⃣ INTERVAL: Triggers the action (ETA update and auto-reject) every 5 seconds
    const interval = setInterval(() => {
        const currentOrders = ordersRef.current; 
        if (currentOrders.length === 0) return;
        processOrders(currentOrders); 
    }, 5000); 

    return () => {
        unsub();
        clearInterval(interval);
    };
}, [restaurantData?.id]);

  const handleConfirmOrder = async (orderId) => {
    try {
        const orderDocRef = doc(
            db,
            "restaurants",
            restaurantData.id,
            "restaurantOrders",
            orderId
        );

        // 1. PASSING CONFIRMED TIME + TOTALPREPTIME = ESTIMATE READY TIME TO ORDER DOC FOR BASE TIME OF ESTIMATED DELIVERY TIME
        const orderSnap = await getDoc(orderDocRef);
        if (!orderSnap.exists()) {
            console.error("Order document not found:", orderId);
            setError("Order not found.");
            return;
        }

        const orderData = orderSnap.data();
        const totalPrepTime = orderData.totalPrepTime || 0;
        const currentTime = new Date();
        const confirmedTime = Timestamp.fromDate(currentTime);
        const estimatedTimeDate = new Date(currentTime.getTime());
        estimatedTimeDate.setMinutes(currentTime.getMinutes() + totalPrepTime);
        const estimatedPreppedTime = Timestamp.fromDate(estimatedTimeDate);

        //2. BUILD THE COURIER ARRAY (this should be updated)
        const restLat = restaurantData.location.latitude;
        const restLng = restaurantData.location.longitude;
        const couriersCol = collection(db, "couriers");
        const couriersSnap = await getDocs(couriersCol);
        const courierArray = [];

        couriersSnap.forEach((courierDoc) => {
          const cData = courierDoc.data();
          if (cData.location && typeof cData.location.latitude === "number") {
            const cLat = cData.location.latitude;
            const cLng = cData.location.longitude;

            const distKm = getDistanceInKm(restLat, restLng, cLat, cLng);
            if (distKm <= 50) {
              courierArray.push(courierDoc.id);
            }
          }
        });

        // --- 3. UPDATE ORDER IN FIRESTORE ---
        await updateDoc(orderDocRef, {
            orderConfirmed: true,
            deliveryStatus: "Confirmed, order being prepared.",
            courierArray: courierArray,
            confirmedTime: confirmedTime,
            estimatedPreppedTime: estimatedPreppedTime,
        });

        //

        setOrders((prev) =>
            prev.map((o) =>
                o.orderId === orderId
                    ? {
                        ...o,
                        orderConfirmed: true,
                        deliveryStatus: "Confirmed, order being prepared.",
                        courierArray: courierArray,
                        confirmedTime: confirmedTime,
                        estimatedPreppedTime: estimatedPreppedTime,
                      }
                    : o
            )
        );
    } catch (err) {
        console.error("Error confirming order:", err);
        setError("Failed to confirm order.");
    }
  };

  const handleRejectOrder = async (orderId) => {
    // 1. Define the reference to the order document
    const orderDocRef = doc(
        db,
        "restaurants",
        restaurantData.id,
        "restaurantOrders",
        orderId
    );
    
    try {
        // --- 1. READ the document to get the userId ---
        const orderSnapshot = await getDoc(orderDocRef);
        if (!orderSnapshot.exists()) {
            console.error(`Order ${orderId} not found.`);
            setError("Order not found.");
            return;
        }

        const orderData = orderSnapshot.data();
        const userId = orderData.userId;

        if (!userId) {
            console.error(`userId not found on order ${orderId}. Cannot notify customer.`);
        }
        
        // --- 2. UPDATE the Order Status (Rejection) ---
        await updateDoc(orderDocRef, {
            orderConfirmed: false,
            deliveryStatus: "Rejected by restaurant.",
            
        });

        console.log(`Order ${orderId} successfully rejected.`);
        
        // --- 3. SEND Message to Customer (Conditional on userId) ---
        if (userId) {
            const messagesRef = collection(db, "users", userId, "messages");
            
            await addDoc(messagesRef, {
                createdAt: serverTimestamp(), // Use Firestore serverTimestamp
                message: "Rejected by restaurant. Order could not be fulfilled, refund sent.",
                read: false, 
                type: "order_status",
                orderId: orderId,
            });
            
            console.log(`Message sent to user ${userId}.`);
        }

        // --- 4. Update Local State ---
        setOrders((prev) =>
            prev.map((o) =>
                o.orderId === orderId
                    ? {
                        ...o,
                        orderConfirmed: false,
                        deliveryStatus: "Rejected by restaurant.",
                    }
                    : o
            )
        );
    } catch (err) {
        console.error("Error rejecting order or sending message:", err);
        setError("Failed to reject order.");
    }
  };

  /* AUTO ACCEPT AND REJECT ORDER */
  const handledOrders = useRef(new Set());
  useEffect(() => {
    if (!restaurantData?.id || orders.length === 0) return;

    const unhandled = orders.filter(
      o => o.orderConfirmed == null && !handledOrders.current.has(o.orderId)
    );
    if (unhandled.length === 0) return;
    if (settings.autoSetting === "accept") {
      for (const order of unhandled) {
        if (order.restaurantNote.length > 0) {
          console.log(`⚠️ Order ${order.orderId} skipped auto-accept due to special customer note. Manual review required.`);
        } else {
          handledOrders.current.add(order.orderId);
          handleConfirmOrder(order.orderId);
        }
      }
    } else if (settings.autoSetting === "reject") {
      for (const order of unhandled) {
        handledOrders.current.add(order.orderId);
        handleRejectOrder(order.orderId);
      }
    }
  }, [orders, restaurantData, settings]);

  // Rendering
  if (loadingAuth || fetchingRestaurant) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (error)
    return (
      <div className="p-6 text-red-600 font-semibold">
        Error: {error}
      </div>
    );
  
  const unhandledOrders = orders.filter(order => order.orderConfirmed == null);
  const rejectedOrders = orders.filter(order => order.orderConfirmed === false);
  const confirmedOrders = orders.filter(order => order.orderConfirmed === true);
  const pendingCount = unhandledOrders.length;

return (
  <div className="flex min-h-screen">
    <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} newOrderCount={pendingCount}/>

    <div className="flex-grow p-6">
      <h1 className="text-3xl font-bold mb-6">
        Restaurant Manager Dashboard
      </h1>
      <h2 className="text-2xl font-bold mb-6">
        Welcome, {user.displayName || user.email} (Restaurant Manager)
      </h2>

      {/* 1. Restaurant Info Tab (activeTab === "info") */}
      {activeTab === "info" && (
        <>
          <h2 className="text-2xl font-semibold mb-4">
            General Information & Settings
          </h2>

          {/* Existing Restaurant Info Display */}
          <div className="mt-6 bg-gray-100 p-4 rounded shadow">
            <h3 className="text-xl font-semibold mb-2">Current Details</h3>
            <p>
              <strong>Restaurant ID:</strong> {restaurantData.restaurantId}
            </p>
            <p>
              <strong>Created At:</strong>{" "}
              {restaurantData.createdAt?.toDate
                ? restaurantData.createdAt.toDate().toLocaleString()
                : new Date(restaurantData.createdAt).toLocaleString()}
            </p>
            <p>
              <strong>Email:</strong> {restaurantData.email}
            </p>
            <p>
              <strong>Name:</strong> {restaurantData.name}
            </p>
            <p>
              <strong>Address / Location:</strong> {restaurantData.address} / Lat:{" "}
              {restaurantData.location?.latitude}, Lng:{" "}
              {restaurantData.location?.longitude}
            </p>
            <p>
              <strong>Rating:</strong> {restaurantData.rating}
            </p>
            <p>
              <strong>Total Orders:</strong> {restaurantData.totalOrders}
            </p>
          </div>

          {/* Form to edit restaurant info */}
          <form
            className="mt-6 space-y-4 max-w-md"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target;
              const storeName = form.storeName.value.trim();
              const address = form.address.value.trim();
              const phone = form.phone.value.trim();
              const type = selectedType;

              if (!phoneRegex.test(phone)) {
                alert("Please enter a valid phone number (e.g. 123-456-7890)");
                return;
              }

              try {
                // Assuming geocodeAddress, GeoPoint, formatHoursForFirestore are available
                const { lat, lng } = await geocodeAddress(address); 
                const location = new GeoPoint(lat, lng);
                const formattedHours = formatHoursForFirestore(hoursState);

                const updated = {
                  storeName,
                  address,
                  phone,
                  type,
                  location,
                  hours: formattedHours,
                };

                const docRef = doc(db, "restaurants", restaurantData.id);
                await updateDoc(docRef, updated);

                setRestaurantData((prev) => ({ ...prev, ...updated }));
                alert("Restaurant info updated");
              } catch (err) {
                console.error("Update restaurant error:", err);
                alert("Failed to update restaurant info");
              }
            }}
          >
            <h3 className="text-xl font-semibold pt-4">Edit Restaurant Info</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700">Store Name</label>
              <input
                name="storeName"
                defaultValue={restaurantData.storeName || ""}
                required
                className="w-full border px-2 py-1 rounded mt-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <input
                name="address"
                defaultValue={restaurantData.address || ""}
                required
                className="w-full border px-2 py-1 rounded mt-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input
                name="phone"
                defaultValue={restaurantData.phone || ""}
                required
                className="w-full border px-2 py-1 rounded mt-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              {loadingTypes ? (
                <p className="text-sm text-gray-500">Loading cuisine types...</p>
              ) : (
                <select
                  name="type"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  required
                  className="w-full border px-2 py-1 rounded bg-white mt-1"
                  disabled={cuisineTypes.length === 0}
                >
                  <option value="" disabled>Select a cuisine type</option>
                  {cuisineTypes.map((typeOption) => (
                    <option key={typeOption} value={typeOption}>
                      {typeOption}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="mt-4 p-4 bg-white rounded shadow-inner">
              <h3 className="font-semibold text-gray-800">Working Hours (HHMM format)</h3>
              {Object.entries(hoursState).map(([day, { Opening, Closing }]) => (
                <div key={day} className="flex items-center gap-4 mb-2">
                  <span className="w-20 font-medium text-sm">{day}</span>
                  <input
                    type="text"
                    value={Opening}
                    onChange={(e) =>
                      setHoursState((prev) => ({
                        ...prev,
                        [day]: { ...prev[day], Opening: e.target.value },
                      }))
                    }
                    placeholder="0900"
                    className="border px-2 py-1 w-24 rounded text-sm"
                  />
                  <input
                    type="text"
                    value={Closing}
                    onChange={(e) =>
                      setHoursState((prev) => ({
                        ...prev,
                        [day]: { ...prev[day], Closing: e.target.value },
                      }))
                    }
                    placeholder="1700"
                    className="border px-2 py-1 w-24 rounded text-sm"
                  />
                </div>
              ))}
            </div>
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full font-medium"
            >
              Save Info
            </button>
          </form>
        </>
      )}

      {/* 2. Menu Management Tab (activeTab === "menu") */}
      {activeTab === "menu" && (
        <MenuTab 
          restaurantData={restaurantData} 
          setRestaurantData={setRestaurantData} 
          db={db}
          doc={doc}
          updateDoc={updateDoc}
        />
      )}

          
      {/* 3. Order Management Tab (activeTab === "orders") */}
      {activeTab === "orders" && (
          <OrdersTab
              restaurantData={restaurantData}
              loadingOrders={loadingOrders}
              unhandledOrders={unhandledOrders}
              confirmedOrders={confirmedOrders}
              handleConfirmOrder={handleConfirmOrder}
              handleRejectOrder={handleRejectOrder}
          />
      )}
      {/* 4. Order History Tab (activeTab === "orderHistory") 
      This is where all orders that have completed the cycle go: A. Rejected by Timeout && B. Rejected by Restaurant Manager
      C. Courier picked-up
      */}
      {activeTab === "orderHistory" && (
        <OrderHistoryTab
          loadingOrders={loadingOrders}
          allOrders={orders}
        />
      )}

      {/* 5. Settings Tab (activeTab === "settings") */}
      {activeTab === "settings" && (
        <SettingsTab
          settings={settings}
          onUpdateSettings={async (newSettings) => {
            setSettings(newSettings);

            try {
              const docRef = doc(db, "restaurants", restaurantData.id);
              await updateDoc(docRef, {
                autoSetting: newSettings.autoSetting,
              });

              console.log("✅ Settings saved to Firestore:", newSettings);
            } catch (err) {
              //console.error("❌ Failed to save settings:", err);
            }
          }}
        />
      )}
    </div>
  </div>
);
}


/*
**** The accepted orders under heading "Orders awaiting pickup"
       * button "Pick-up completed" pressed -> deliveryStatus: "order being delivered" (hypothetical: on courier arrival, courierId match)

~All restaurantOrders: a periodically updating function that assigns orders to multiple couriers based on (currently: each restaurant is doing this client side, doesn't work if the client restaurant not online);
- Need a rejectedArray if courier rejects
- Need a periodic courierArray updater that checks against rejectedArray and only updates if courierId = ""
- If no available couriers, reassign to rejectedArray with higher earning
* courierArray created to find all nearby couriers available for order (should be admin server job for orderConfirmed=true orders and updated consistently)

* Later: Delete button in settings
* Later: Add a precise location pointer on clicking the map (reason: the geolocator is not that precise)
* Maybe: field to upload logo that appears on map
* Advanced: If restaurant does not accept the order -> refund user if not accepted
*/

