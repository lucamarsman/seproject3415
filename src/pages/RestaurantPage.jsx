import { useEffect, useState, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Navigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  GeoPoint,
  Timestamp,
  doc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  increment,
  query,
  where,
} from "firebase/firestore";
import { updateOrderToRejected } from "../utils/updateOrderToRejected.js"; //utils
import { coordinateFormat } from "../utils/coordinateFormat.js";
import { geocodeAddress } from "../utils/geocodeAddress.js";
import { calculateEtaRestaurant } from "../utils/calculateEtaRestaurant.js";

import InfoTab from "../components/RestaurantPage/infoTab"; //components
import Sidebar from "../components/RestaurantPage/sidebar";
import OrdersTab from "../components/RestaurantPage/ordersTab";
import OrderHistoryTab from "../components/RestaurantPage/orderHistoryTab";
import MenuTab from "../components/RestaurantPage/menuTab";
import SettingsTab from "../components/RestaurantPage/settingsTab";

import RestaurantPageSkeleton from "../components/RestaurantPageSkeleton.jsx";
import InfoTabSkeleton from "../components/InfoTabSkeleton.jsx";
import MenuTabSkeleton from "../components/MenuTabSkeleton.jsx";
import OrdersTabSkeleton from "../components/OrdersTabSkeleton.jsx";
import OrderHistoryTabSkeleton from "../components/OrderHistoryTabSkeleton.jsx";
import RestaurantSettingsTabSkeleton from "../components/RestaurantSettingsTabSkeleton.jsx";

// HELPER FUNCTION: populate the local state hours
function parseHoursArray(hoursArray) {
  const result = {};
  hoursArray.forEach((dayObj) => {
    const [day, times] = Object.entries(dayObj)[0];
    result[day] = times;
  });
  return result;
}

// HELPER FUNCTION: format hours to Firestore database format: array/map
function formatHoursForFirestore(hoursObject) {
  return Object.entries(hoursObject).map(([day, times]) => ({
    [day]: times,
  }));
}

// RESTAURANT MANAGER PAGE - for logged in restaurant managers
export default function RestaurantPage() {
  const [activeTab, setActiveTab] = useState("info");
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [restaurantData, setRestaurantData] = useState(null);
  const [fetchingRestaurant, setFetchingRestaurant] = useState(true);
  const [error, setError] = useState("");
  const [hoursState, setHoursState] = useState({});
  const [tabLoading, setTabLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [cuisineTypes, setCuisineTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [selectedType, setSelectedType] = useState("");
  const [settings, setSettings] = useState({
    autoSetting: "manual",
    serviceRange: 50,
  });

  // useEffect: Authentication listener - for displaying either a new or existing account, during login
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoadingAuth(false);
    });
    return () => unsub();
  }, []);

  // useEffect: Timeout for visual loading effect on page load
  useEffect(() => {
    if (loadingAuth || fetchingRestaurant) return;
    setTabLoading(true);
    const id = setTimeout(() => {
      setTabLoading(false);
    }, 600);

    return () => clearTimeout(id);
  }, [activeTab, loadingAuth, fetchingRestaurant]);

  // useEffect: Get cuisine type icons from Firestore database collection systemFiles
  useEffect(() => {
    const fetchCuisineTypes = async () => {
      setLoadingTypes(true);
      try {
        const docRef = doc(db, "systemFiles", "systemVariables");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && Array.isArray(docSnap.data().typeIcons)) {
          const types = docSnap
            .data()
            .typeIcons.map((item) => item.type)
            .filter((type) => type);

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

  // useEffect: sets the restaurant data to the local state
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

  // userEffect: Fetch or create restaurant based on logged-in user
  // POTENTIAL UPDATE: UID could be used here, but everyone would have to recreate their restaurants
  // While the UID is the same for User, Restaurant, and Courier -> the search path is different (so it will return the correct data)
  useEffect(() => {
    if (!user) return;

    const restaurantsRef = collection(db, "restaurants");

    const fetchOrCreate = async () => {
      try {
        const qEmail = query(restaurantsRef, where("email", "==", user.email));
        let snapshot = await getDocs(qEmail);
        const matchedDoc = snapshot.docs[0]; //there can only be 1 restautant per email; and email is unique

        if (matchedDoc) {
          const data = matchedDoc.data();
          setRestaurantData({ id: matchedDoc.id, ...data });
          setSettings({
            autoSetting: data.autoSetting ?? "manual",
            serviceRange: data.serviceRange ?? 50,
          });
          setTimeout(() => setFetchingRestaurant(false), 600);
          return;
        }

        const docRef = doc(restaurantsRef);
        const newRest = {
          address: "",
          autoSetting: "manual",
          createdAt: Timestamp.fromDate(new Date()),
          earnings: 0,
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
          restaurantId: docRef.id,
          serviceRange: 50,
          storeName: "",
          totalOrders: 0,
          type: "",
        };

        await setDoc(docRef, newRest);

        setRestaurantData({
          id: docRef.id,
          restaurantId: docRef.id,
          ...newRest,
        });
        setFetchingRestaurant(false);
      } catch (err) {
        console.error("Error in fetchOrCreate restaurant:", err);
        setError("Error setting up your restaurant info.");
        setFetchingRestaurant(false);
      }
    };

    fetchOrCreate();
  }, [user]);

  // VARIABLE: Realtime listener for restaurantOrders
  const ordersRef = useRef(orders);
  // useEffect: Updates ordersRef whenever the 'orders' state changes
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // FUNCTION: Archiving collection restaurantOrders orders to collection orderHistory (in the case the user does not press button "Confirm Delivery" - optional)
  const archiveOldOrders = async (ordersToProcess, restaurantId) => {
    if (!restaurantId) return;
    const ONE_HOUR_MS = 1 * 60 * 60 * 1000;
    const currentTime = new Date().getTime();
    console.log(currentTime);

    const oldOrdersToArchive = ordersToProcess.filter((order) => {
      // Case A: orderCompleted = true and 1+ hours old (Courier delivered)
      const isOldCompleted =
        order.orderCompleted === true &&
        order.completedAt?.toDate?.() &&
        currentTime - order.completedAt.toDate().getTime() > ONE_HOUR_MS;

      // Case B: orderConfirmed = false and 1+ hours old (Rejected by restaurant/timeout)
      const isOldRejected =
        order.orderConfirmed === false &&
        order.createdAt?.toDate?.() &&
        currentTime - order.createdAt.toDate().getTime() > ONE_HOUR_MS;

      return isOldCompleted || isOldRejected;
    });

    if (oldOrdersToArchive.length === 0) {
      console.log("No old orders to archive.");
      return;
    }

    const batch = writeBatch(db); // copy the old order to orderHistory archive; then delete it in a single write
    const archivedOrderIds = [];
    for (const order of oldOrdersToArchive) {
      const orderId = order.orderId;
      const originalOrderRef = doc(db, "restaurants", restaurantId, "restaurantOrders", orderId);
      const historyOrderRef = doc(db, "restaurants", restaurantId, "orderHistory", orderId);

      const historyData = {
        ...order,
        archivedAt: serverTimestamp(),
      };
      batch.set(historyOrderRef, historyData);
      batch.delete(originalOrderRef);
      archivedOrderIds.push(orderId);
    }
    try {
      await batch.commit();
      setOrders((prev) =>
        prev.filter((o) => !archivedOrderIds.includes(o.orderId))
      );
      console.log(
        `Successfully archived and deleted old orders: ${archivedOrderIds.join(", ")}`
      );
    } catch (error) {
      console.error("Archiving of old orders failed:", error);
    }
  };

  // useEffect: Updates all order statuses (using a 5000 ms polling strategy)
  // MAJOR FUNCTIONS: 1. Calculating individual order ETA related to the restaurant
  //                  2. Updating order status of timed out orders (rejections)
  useEffect(() => {
    if (!restaurantData?.id) return;
    const ordersCollectionRef = collection(db, "restaurants", restaurantData.id, "restaurantOrders");
    let firstLoad = true;

    const processOrders = async (ordersArray) => {
      // 1. COURIER TRACKING AND ETA CALCULATION (activeOrders only)
      const activeOrders = ordersArray.filter(
        (order) =>
          order.courierConfirmed === true &&
          order.courierId &&
          order.restaurantLocation &&
          order.userLocation &&
          order.courierPickedUp === false
      );

      if (activeOrders.length > 0) {
        const uniqueCourierIds = new Set(
          activeOrders.map((order) => order.courierId)
        );
        const courierDataMap = new Map();
        const updateBatch = writeBatch(db);
        const localUpdates = [];

        // Fetch all unique courier locations
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
        
        // Calculate ETA of all active orders
        for (const order of activeOrders) {
          const courier = courierDataMap.get(order.courierId);
          const courierLocation = coordinateFormat(courier?.location);
          const restaurantLocation = coordinateFormat(order.restaurantLocation);
          const userLocation = coordinateFormat(order.userLocation);

          // Validate all coordinates to prevent ETA calculation errors
          const locationValid =
            courierLocation &&
            typeof courierLocation.latitude === "number" &&
            typeof courierLocation.longitude === "number" &&
            restaurantLocation &&
            typeof restaurantLocation.latitude === "number" &&
            typeof restaurantLocation.longitude === "number" &&
            userLocation &&
            typeof userLocation.latitude === "number" &&
            typeof userLocation.longitude === "number";
          const now = new Date();
          let preppedDate = new Date(now.getTime() + 5 * 60000);
          let remainingPrepDurationMinutes = 5; // Default

          if (order.estimatedPreppedTime?.toDate) { // in case estimatedPreppedTime not defined or null
            preppedDate = order.estimatedPreppedTime.toDate();
            remainingPrepDurationMinutes = Math.max(0, Math.round((preppedDate.getTime() - now.getTime()) / 60000) // convert milliseconds to minutes
            );
          }

          let updates = {};
          let newDeliveryStatus;

          if (locationValid) {
            updates = calculateEtaRestaurant(
              {
                courierLoc: courierLocation,
                restaurantLoc: restaurantLocation,
                userLoc: userLocation,
              },
              now,
              preppedDate
            );

            newDeliveryStatus = "Awaiting courier pick-up.";
            console.log(`Delivery Status updated for order ${order.orderId}`);
          } else {
            console.log("Courier location issue.");
          }

          // Update the order document with updates values
          const orderRef = doc(db, "restaurants", restaurantData.id, "restaurantOrders", order.orderId);
          updateBatch.update(orderRef, {
            courierLocation: courierLocation,
            courier_R_Distance: updates.C_R_distanceKm || NaN,
            courier_U_Distance: updates.R_U_distanceKm || NaN,
            deliveryStatus: newDeliveryStatus,
            estimatedPickUpTime: updates.estimatedPickUpTimeTimestamp || null,
            estimatedDeliveryTime:
              updates.estimatedDeliveryTimeTimestamp || null,
            total_Distance: updates.total_Distance || NaN,
          });

          // Update the local state
          localUpdates.push({
            orderId: order.orderId,
            deliveryStatus: newDeliveryStatus,
          });
        }
        // Pass to Firestore database
        if (localUpdates.length > 0) {
          try {
            await updateBatch.commit();
            setOrders((prevOrders) =>
              prevOrders.map((order) => {
                const update = localUpdates.find(
                  (u) => u.orderId === order.orderId
                );
                return update
                  ? { ...order, deliveryStatus: update.deliveryStatus }
                  : order;
              })
            );
          } catch (error) {
            console.error("Batch ETA update failed:", error);
          }
        }
      }

      // 2. TIMEOUT REJECTION - reject the order if order.orderTimeout < current date (now)
      const now = new Date();
      const timedOutOrders = ordersArray.filter((order) => {
        const timeout =
          order.orderTimeout?.toDate?.() ||
          (order.orderTimeout ? new Date(order.orderTimeout) : null);
        const shouldReject =
          timeout && order.orderConfirmed === null && timeout < now;
        if (shouldReject) {
          console.log(`!!! Order ${order.orderId} is TIMED OUT.`);
        }
        return shouldReject;
      });

      if (timedOutOrders.length === 0) return;

      // 2A. Update all timed-out orders
      const rejectionResults = await Promise.all(
        timedOutOrders.map((order) =>
          updateOrderToRejected(restaurantData.id, order.orderId)
        )
      );

      // 2B. Update local state for all successful rejections
      const successfullyRejectedIds = timedOutOrders
        .filter((_, index) => rejectionResults[index].success)
        .map((order) => order.orderId);

      if (successfullyRejectedIds.length > 0) {
        setOrders((prevOrders) => {
          return prevOrders.map((order) => {
            if (successfullyRejectedIds.includes(order.orderId)) {
              console.log(
                `[Local Update] Rejected order ${order.orderId} status updated.`
              );
              return {
                ...order,
                orderConfirmed: false,
                deliveryStatus: "Auto-rejected: Order timed out.",
              };
            }
            return order;
          });
        });
      }
    };

    // REAL-TIME LISTENER: Updates the UI/local state (setOrders) and manages loading
    const unsub = onSnapshot(
      ordersCollectionRef,
      (snapshot) => {
        const fetchedOrders = snapshot.docs.map((docSnap) => ({
          orderId: docSnap.id,
          ...docSnap.data(),
        }));

        setOrders(fetchedOrders);

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

    // INTERVAL: Triggers polling action (ETA update and auto-reject) every 5 seconds
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

  // FUNCTION: Case - Restaurant accepts order
  const handleConfirmOrder = async (orderId) => {
    // Get order data
    try {
      const orderDocRef = doc(db, "restaurants", restaurantData.id, "restaurantOrders", orderId);
      let orderData = orders.find((o) => o.orderId === orderId);
      if (!orderData) {
        const orderSnap = await getDoc(orderDocRef);
        if (!orderSnap.exists()) {
          console.error("Order document not found:", orderId);
          setError("Order not found.");
          return;
        }
        orderData = orderSnap.data();
      }
      const totalPrepTime = orderData.totalPrepTime || 0; 

      // 1. Update the restaurant itself: restaurants/{restaurantId} with payment data
      const restaurantRef = doc(db, "restaurants", restaurantData.id);
      const paymentRestaurant = orderData.paymentRestaurant || 0;
      await updateDoc(restaurantRef, {
        earnings: increment(paymentRestaurant),
      });

      const currentTime = new Date();
      const confirmedTime = Timestamp.fromDate(currentTime);
      const estimatedTimeDate = new Date(currentTime.getTime());
      estimatedTimeDate.setMinutes(currentTime.getMinutes() + totalPrepTime);
      const estimatedPreppedTime = Timestamp.fromDate(estimatedTimeDate);

      // 2A. Update the restaurant order: orderDocRef with with accepted order value changes
      await updateDoc(orderDocRef, {
        orderConfirmed: true,
        deliveryStatus: "Confirmed, order being prepared.",
        confirmedTime: confirmedTime,
        estimatedPreppedTime: estimatedPreppedTime,
      });

      // 2B. Update the local state with current order changes
      setOrders((prev) =>
        prev.map((o) =>
          o.orderId === orderId
            ? {
                ...o,
                orderConfirmed: true,
                deliveryStatus: "Confirmed, order being prepared.",
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

   // FUNCTION: Case - Restaurant rejects order
  const handleRejectOrder = async (orderId) => {
    // Get order data
    const orderDocRef = doc(db, "restaurants", restaurantData.id, "restaurantOrders", orderId);
    try {
      const orderSnapshot = await getDoc(orderDocRef);
      if (!orderSnapshot.exists()) {
        console.error(`Order ${orderId} not found.`);
        setError("Order not found.");
        return;
      }
      const orderData = orderSnapshot.data();
      const userId = orderData.userId;
      if (!userId) {
        console.error(
          `userId not found on order ${orderId}. Cannot notify customer.`
        );
      }

      // 1A. Update the restaurant order status variables to rejected
      await updateDoc(orderDocRef, {
        orderConfirmed: false,
        deliveryStatus: "Rejected by restaurant.",
      });
      console.log(`Order ${orderId} successfully rejected.`);

      // 1B. Create a message to the user (informing them of a rejected order)
      if (userId) {
        const messagesRef = collection(db, "users", userId, "messages");
        await addDoc(messagesRef, {
          createdAt: serverTimestamp(),
          message:
            "Rejected by restaurant. Order could not be fulfilled, refund sent.",
          read: false,
          type: "order_status",
          orderId: orderId,
        });

        console.log(`Message sent to user ${userId}.`);
      }

      // 1C. Update the local state with current order changes
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

  // useEffect: handles restaurant order cases when there is a note
  const handledOrders = useRef(new Set());
  useEffect(() => {
    if (!restaurantData?.id || orders.length === 0) return;

    const unhandled = orders.filter(
      (o) => o.orderConfirmed == null && !handledOrders.current.has(o.orderId)
    );
    if (unhandled.length === 0) return;
    // If restaurant is set to autoSetting "accept", orders now require a manual review by the restaurant manager
    // Order is now subject to its timeout value (it can be rejected)
    if (settings.autoSetting === "accept") {
      for (const order of unhandled) {
        if (order.restaurantNote.length > 0) {
          console.log(
            `Order ${order.orderId} skipped auto-accept customer note. Manual review required.`
          );
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

  // ERROR PREVENTION (PAGE)
  if (loadingAuth || fetchingRestaurant) return <RestaurantPageSkeleton />;
  if (!user) return <Navigate to="/login" />;
  if (error)
    return <div className="p-6 text-red-600 font-semibold">Error: {error}</div>;

  // Arrays of orders to be viewed under separate headings
  // Restaurant orderTab heading: New Orders
  const unhandledOrders = orders.filter(
    (order) => order.orderConfirmed == null
  );
  // Restaurant orderTab heading: Confirmed Orders
  const confirmedOrders = orders.filter(
    (order) => order.orderConfirmed === true && order.courierConfirmed === false
  );
  // Restaurant orderTab heading: Confirmed Confirmed Orders
  const courierConfirmedOrders = orders.filter(
    (order) =>
      order.courierConfirmed === true && order.courierPickedUp === false
  );
  const pendingCount = unhandledOrders.length;

  // USER INTERFACE
  return (
    <div className="flex min-h-screen">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        newOrderCount={pendingCount}
      />

      <div className="flex-grow p-6">
        <h1 className="text-3xl font-bold mb-6">
          Restaurant Manager Dashboard
        </h1>
        <h2 className="text-2xl font-bold mb-6">
          Welcome, {user.displayName || user.email} (Restaurant Manager) of{" "}
          {restaurantData.storeName}
        </h2>

        {tabLoading ? (
          <>
            {activeTab === "info" && <InfoTabSkeleton />}
            {activeTab === "menu" && <MenuTabSkeleton />}
            {activeTab === "orders" && <OrdersTabSkeleton />}
            {activeTab === "orderHistory" && <OrderHistoryTabSkeleton />}
            {activeTab === "settings" && <RestaurantSettingsTabSkeleton />}
          </>
        ) : (
          <>
            {activeTab === "info" && (
              <InfoTab
                restaurantData={restaurantData}
                setRestaurantData={setRestaurantData}
                cuisineTypes={cuisineTypes}
                loadingTypes={loadingTypes}
                db={db}
                geocodeAddress={geocodeAddress}
                formatHoursForFirestore={formatHoursForFirestore}
                parseHoursArray={parseHoursArray}
              />
            )}

            {activeTab === "menu" && (
              <MenuTab
                restaurantData={restaurantData}
                setRestaurantData={setRestaurantData}
                db={db}
                doc={doc}
                updateDoc={updateDoc}
              />
            )}

            {activeTab === "orders" && (
              <OrdersTab
                restaurantData={restaurantData}
                loadingOrders={loadingOrders}
                unhandledOrders={unhandledOrders}
                confirmedOrders={confirmedOrders}
                courierConfirmedOrders={courierConfirmedOrders}
                handleConfirmOrder={handleConfirmOrder}
                handleRejectOrder={handleRejectOrder}
              />
            )}

            {activeTab === "orderHistory" && (
              <OrderHistoryTab
                loadingOrders={loadingOrders}
                allOrders={orders}
                archiveOldOrders={() =>
                  archiveOldOrders(orders, restaurantData.id)
                }
              />
            )}

            {activeTab === "settings" && (
              <SettingsTab
                settings={settings}
                onUpdateSettings={async (newSettings) => {
                  const updatedSettings = { ...settings, ...newSettings };
                  setSettings(updatedSettings);

                  try {
                    const docRef = doc(db, "restaurants", restaurantData.id);
                    await updateDoc(docRef, {
                      autoSetting: updatedSettings.autoSetting,
                      serviceRange: updatedSettings.serviceRange,
                    });
                    console.log(
                      "Settings saved to Firestore:",
                      updatedSettings
                    );
                  } catch (err) {
                    console.error("Failed to save settings:", err);
                  }
                }}
              />
            )}
          </>
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
- If no available couriers, reassign to rejectedArray with higher earning

* Later: Delete button in settings
* Later: Add a precise location pointer on clicking the map (reason: the geolocator is not that precise)
* Maybe: field to upload logo that appears on map
* Advanced: If restaurant does not accept the order -> refund user if not accepted
*/
