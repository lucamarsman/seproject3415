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
  updateDoc,
  doc,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { calculateEtaCourier } from '../utils/calculateEtaCourier';
import { coordinateFormat } from '../utils/coordinateFormat';

export default function CourierPage() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [courierData, setCourierData] = useState(null);
  const [fetchingCourier, setFetchingCourier] = useState(true);
  const [error, setError] = useState("");
  const [locationAccessDenied, setLocationAccessDenied] = useState(false);
  const [orders, setOrders] = useState([]);
  const [fetchingOrders, setFetchingOrders] = useState(true);
  const [currentTask, setCurrentTask] = useState(null);
  const courierDataRef = useRef(courierData);
  const currentTaskRef = useRef(currentTask);

  useEffect(() => {
    courierDataRef.current = courierData;
  }, [courierData]);

  useEffect(() => {
    currentTaskRef.current = currentTask;
  }, [currentTask]);

  // Helper: Update courier status in Firestore and state
  const updateCourierDoc = async (updates) => {
    const currentCourierId = courierDataRef.current?.id;
    if (!currentCourierId) return;

    if (updates.location) {
        updates.location = new GeoPoint(updates.location.latitude, updates.location.longitude);
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

  // Helper: Returns a user-friendly location error message based on code
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoadingAuth(false);
    });
    return unsubscribe;
  }, []);

  // 1. Initial Fetch/Create Courier Logic (unchanged for brevity, but needed)
  useEffect(() => {
    if (!user) return;

    const couriersRef = collection(db, "couriers");

    const fetchOrCreateCourier = async () => {
      try {
        const snapshot = await getDocs(couriersRef);

        const matchedDoc = snapshot.docs.find((doc) => {
          const data = doc.data();
          const emailMatch = data.email === user.email;
          const nameMatch =
            data.name?.toLowerCase().trim() ===
            user.displayName?.toLowerCase().trim();
          return emailMatch || nameMatch;
        });

        if (matchedDoc) {
          setCourierData({ id: matchedDoc.id, ...matchedDoc.data() });
          setFetchingCourier(false);
          return;
        }

        if (!navigator.geolocation) {
          setError(
            "Location services are unavailable on your device. Please enable location access to resume courier capabilities."
          );
          setFetchingCourier(false);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;

            const newCourier = {
              email: user.email,
              name: user.displayName,
              earnings: 0,
              location: new GeoPoint(latitude, longitude),
              movementFlag: "inactive",
              status: "inactive",
            };

            const docRef = await addDoc(couriersRef, newCourier);
            await updateDoc(docRef, { courierId: docRef.id });

            setCourierData({ id: docRef.id, courierId: docRef.id, ...newCourier });
            setFetchingCourier(false);
          },
          (err) => {
            console.error("Location error", err);
            const message = getLocationErrorMessage(err.code);
            setError(message);

            if (err.code === 1) {
              setLocationAccessDenied(true);
            }

            if (courierData?.id && courierData.status !== "inactive") {
              updateCourierStatus("inactive");
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

  // Helper: Update Order Task ETA
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

    const locationValid = (
      formattedCourierLoc && typeof formattedCourierLoc.latitude === 'number' && typeof formattedCourierLoc.longitude === 'number' &&
      formattedUserLoc && typeof formattedUserLoc.latitude === 'number' && typeof formattedUserLoc.longitude === 'number'
    );

    if (!locationValid) {
      console.warn(`Location data invalid for task ${task.orderId}. Cannot calculate ETA.`);
      return;
    }

    let updates = {};

    if (task.courierPickedUp) {
      updates = calculateEtaCourier(formattedCourierLoc, formattedUserLoc, now);
      updates.deliveryStatus = "Delivery enroute.";
      updates.courierLocation = formattedCourierLoc;

      const orderDocRef = doc(
        db,
        "restaurants",
        task.restaurantId,
        "restaurantOrders",
        task.orderId
      );

      try {
        await updateDoc(orderDocRef, updates);
        
        // Update local state 
        setCurrentTask(prev => ({ 
            ...prev, 
            ...updates,
            estimatedDeliveryTime: updates.estimatedDeliveryTime 
        }));
        
      } catch (err) {
        console.error(`Failed to update task ${task.orderId} ETA:`, err);
        setError("Failed to update task ETA.");
      }
    }
  };


  // 3. UNIFIED INTERVAL (5000 MS) for Location Fetching and Database Writes
  useEffect(() => {
    const courierId = courierData?.id;
    if (!courierId || !navigator.geolocation) return;

    const fetchAndWriteLocation = () => {
        if (locationAccessDenied) return;

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const formattedLocation = { latitude, longitude };

                setCourierData((prev) => ({
                    ...prev,
                    location: formattedLocation,
                }));

                updateCourierDoc({ location: formattedLocation });

                if (currentTaskRef.current) {
                    updateCourierTask(formattedLocation);
                }

                if (locationAccessDenied) {
                    setLocationAccessDenied(false);
                    setError("");
                }
            },
            (err) => {
                console.error("Location error during interval:", err.code, err.message);

                if (err.code === 1) { // PERMISSION DENIED
                    setLocationAccessDenied(true);
                    setError(getLocationErrorMessage(err.code));
                    if (courierDataRef.current?.status !== "inactive") {
                        updateCourierDoc({ status: "inactive" });
                    }
                } 
            },
            { enableHighAccuracy: true, maximumAge: 0 } 
        );
    };
    const interval = setInterval(fetchAndWriteLocation, 5000);
    fetchAndWriteLocation();

    return () => {
        clearInterval(interval);
    };
  }, [courierData?.id, locationAccessDenied]);

  // 4. Fetch Orders, handleAccept, handleReject (unchanged)
  useEffect(() => {
    const fetchAllOrders = async () => {
      try {
        const restaurantsRef = collection(db, "restaurants");
        const restaurantsSnapshot = await getDocs(restaurantsRef);

        let availableOrders = [];
        let assignedOrder = null;

        for (const restaurantDoc of restaurantsSnapshot.docs) {
          const restaurantId = restaurantDoc.id;
          const ordersRef = collection(
            db,
            "restaurants",
            restaurantId,
            "restaurantOrders"
          );
          const ordersSnapshot = await getDocs(ordersRef);

          ordersSnapshot.forEach((orderDoc) => {
            const orderData = orderDoc.data();
            const fullOrder = { ...orderData, restaurantId };

            if (
              orderData.orderConfirmed === true &&
              orderData.courierId === courierData?.courierId
            ) {
              assignedOrder = fullOrder;
            }
            else if (
              orderData.orderConfirmed === true &&
              orderData.courierId === "" &&
              Array.isArray(orderData.courierArray) &&
              courierData?.courierId &&
              orderData.courierArray.includes(courierData.courierId)
            ) {
              availableOrders.push(fullOrder);
            }
          });
        }

        setOrders(availableOrders);
        setCurrentTask(assignedOrder);
      } catch (err) {
        console.error("Error fetching orders:", err);
        setError("Failed to fetch orders.");
      } finally {
        setFetchingOrders(false);
      }
    };

    if (courierData?.courierId) {
      fetchAllOrders();
    }
  }, [courierData]);

  // handleAccept 
  const handleAccept = async (order) => {
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
      });

      await batch.commit();

      setCurrentTask({ ...order, courierId: courierData.courierId });
      setOrders((prev) => prev.filter((o) => o.orderId !== order.orderId));
    } catch (err) {
      console.error("Error accepting order:", err);
      setError("Failed to accept order.");
    }
  };

  const handleReject = async (order) => {
    try {
      const orderDocRef = doc(
        db,
        "restaurants",
        order.restaurantId,
        "restaurantOrders",
        order.orderId
      );
      await updateDoc(orderDocRef, {
        courierConfirmed: false,
        courierRejectArray: courierData.courierId,
      });
      setOrders((prev) => prev.filter((o) => o.orderId !== order.orderId));
    } catch (err) {
      console.error("Error rejecting order:", err);
      setError("Failed to reject order.");
    }
  };

  if (loadingAuth) return <div>Loading authentication...</div>;
  if (!user) return <Navigate to="/login" />;

  //COMPONENT UI
  return (
  <div className="p-6">
    <h1 className="text-2xl font-bold">
      Welcome, {user.displayName || user.email} (Courier)
    </h1>

    {error && <p className="mt-4 text-red-600">{error}</p>}

    {fetchingCourier ? (
      <p className="mt-4">Checking your courier profile...</p>
    ) : courierData ? (
      <>
        <table className="mt-6 w-full text-left border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 border">Courier ID</th>
              <th className="p-2 border">Name</th>
              <th className="p-2 border">Email</th>
              <th className="p-2 border">Earnings</th>
              <th className="p-2 border">Location</th>
              <th className="p-2 border">Movement Status</th>
              <th className="p-2 border">GPS Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-2 border">{courierData.courierId}</td>
              <td className="p-2 border">{courierData.name}</td>
              <td className="p-2 border">{courierData.email}</td>
              <td className="p-2 border">${courierData.earnings.toFixed(2)}</td>
              <td className="p-2 border">
                {courierData.location?.latitude.toFixed(8)},{" "}
                {courierData.location?.longitude.toFixed(8)}
              </td>
              <td className="p-2 border">{courierData.movementFlag}</td>
              <td className="p-2 border">{courierData.status}</td>
            </tr>
          </tbody>
        </table>

        <hr className="my-8 border-t-2 border-gray-300" />

        <h2 className="text-xl font-semibold">Current Task</h2>
        {fetchingOrders ? (
          <p>Loading tasks…</p>
        ) : currentTask ? (
          <section className="mb-8">
            <div className="p-4 border rounded bg-gray-100">
              <p><strong>Order ID:</strong> {currentTask.orderId}</p>
              <p><strong>Restaurant:</strong> {currentTask.restaurantAddress}</p>
              <p><strong>User Address:</strong> {currentTask.userAddress}</p>
            </div>
          </section>
        ) : (
          <p>No current tasks.</p>
        )}

        <hr className="my-8 border-t-2 border-gray-300" />

        {/* Task List */}
        <h2 className="text-xl font-semibold mb-4">📝 Task List</h2>
        {fetchingOrders ? (
          <p>Loading tasks…</p>
        ) : orders.length === 0 ? (
          <p>No tasks available.</p>
        ) : (
          <ul className="list-disc list-inside text-gray-600">
            {orders.map((order, idx) => (
              <li key={idx} className="p-4 mb-4 border rounded bg-gray-50">
                <strong>Order ID:</strong> {order.orderId} <br />
                <strong>Items:</strong>
                <ul className="ml-4 list-disc">
                  {order.items.map((item, i) => (
                    <li key={i}>
                      {item.name} × {item.quantity} (prep: {item.prepTime} min)
                    </li>
                  ))}
                </ul>
                <strong>Total Prep Time:</strong> {order.totalPrepTime} min <br />
                <strong>Restaurant Address:</strong> {order.restaurantAddress} <br />
                <strong>User Address:</strong> {order.userAddress}
                <div className="mt-2 space‑x‑2">
                  <button
                    className="bg-green-500 text-white px-3 py-1 rounded"
                    onClick={() => handleAccept(order)}
                  >
                    Accept
                  </button>
                  <button
                    className="bg-red-500 text-white px-3 py-1 rounded"
                    onClick={() => handleReject(order)}
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </>
    ) : null}
  </div>
);
}

/*
TODO
*** For an order to appear
      -> orderData.orderConfirmed === true && orderData.courierId === "" && courierId in courierArray [DONE]
      -> add order "payment" [total, restaurant, courier, system] field to order; need an algorithm to divide up payment
      -> only show payment/courier on the task (incentive to accept); likewise for restaurantPage; likewise for admin record
*** 4. Add an "Accept" or "Reject" button next to 1 task 
      -> to accept, courier/{courierId} field currentTask must be ""; if not alert -> "You must complete your current task before accepting a new one"
      -> If accept, courierId added to order form courierId field [DONE]  && (gps must be active)
      -> After accepting task moves under current task header, courierCurrent task = orderId [DONE]
      -> Car icon appears on user's map according to courier gps
      -> If reject, courierId added to courierRejectArray, another courier must pick it up [DONE]
      -> Later: a new task is offered under Task List (to limit preferential choices)

*** 5. Courier presses "Picked up" button when within a close gps radius -> deliveryStatus: "order being delivered" (if restaurant doesn't)
*** 6. Courier presses "Delivered" button when within a close gps radius -> deliveryStatus: "completed"
*** 7. Order copied to collection: systemFiles/completedOrders -> order deleted from systemFiles/restaurantOrders 
*** 8. couriers/{courierId} field earnings increase = to order "restaurants/{restaurantId}/restaurantOrders/{orderId} field payment/courier" field     

* Later: show 1 task at a time to each courier via server scheduling
* Later: add phone number
* Later: Better UI -> top right nav is CourierPage user profile link (Name, email, phone* Please complete your user profile before continuing)
                      Job disclosure form: standard procedures/rules - gps tracking; click deliveryStatus buttons; 
                      obligation to select movementFlag updates if waiting; add phoneNumber field
* Later: inactivityTimer: initially set to 0; increases if gps value does not change by a significant amount
* Later: movementFlag: initially set to inactive; set to inactive if inactivityTimer > threshold (10min)
* Later: courier must be within a certain distance to accept a task
* Advanced: couriers with multiple tasks are possible [2 people in same area, around same time, order from the same McDonalds]; task gen function in systemFiles restaurant orders


courierId: used by admin to identify the courier on a job task                                                    (essential for job)
currentTask: used by admin to identify if the courier has a task <orderId>                                          [filled / empty]
earnings: 
email: necessary for admin to contact you
inactivityTimer: increases if no significant difference between location coordinates over a period of time, 
                 reset to 0 if courier presses waiting for restaurant, waiting for customer, or movement
location: necessary for inactivity timer calculation
movementFlag: active (moving), inactive (10 min), waiting for restaurant, waiting for customer, need assistance     [active / T]
name: necessary for admin to contact you
phoneNum: necessary for admin to contact you
status: used by admin to identify if the courier has a gps connection                                               [active / T]


# Order sequence:
1. User makes order (OrderPage); orderConfirmed: null; Status: awaiting restaurant confirmation
2. Restaurant confirms, rejects, or a timeout occurs (RestaurantPage)
   If accepted -> orderConfirmed = True -> deliveryStatus: "order confirmed, being prepared"
      rejected -> orderConfirmed = False -> deliveryStatus: "order rejected" (this could then go to another restaurant...)
      timeout -> orderConfirmed = False -> deliveryStatus: "order rejected" (this could then go to another restaurant...)
3. Task shows on CourierPage (if orderConfirmed = True)
   If accept -> courierId value added to order courierId field (to hypothetically match @ restaurant/courier meeting point)
                deliveryStatus = "delivery in progress"
                car icon @ gps of courier shows on UserPage
   If reject -> a new task is offered under Task List (to limit preferential choices)
4. On arrival to the user; courier selects button "delivered" -> deliveryStatus = "completed"
   order copied to collection: systemFiles/completedOrders -> order deleted from systemFiles/restaurantOrders


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