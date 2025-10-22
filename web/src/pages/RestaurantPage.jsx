import { useEffect, useState } from "react";
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
} from "firebase/firestore";
import Sidebar from "../components/RestaurantPage/sidebar";
import defaultProfileImg from "../assets/defaultProfile.svg";
import editIcon from "../assets/edit.svg";

// ADDRESS to GEOLOCATION: OpenCage API
async function geocodeAddress(address) {
  const apiKey = "183a5a8cb47547249e4b3a3a44e9e24f";
  const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(
    address
  )}&key=${apiKey}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.results.length > 0) {
      const { lat, lng } = data.results[0].geometry;
      return { lat, lng };
    } else {
      throw new Error("No results found");
    }
  } catch (err) {
    console.error("Geocoding failed:", err);
    throw err;
  }
}

// DISTANCE of restaurant from couriers
function getDistanceInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2)); // distance in km
}

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

  const [newMenuItem, setNewMenuItem] = useState({
    name: "",
    description: "",
    calories: "",
    price: "",
    prepTime: "",
    imgUrl: "",
    available: true,
  });
  

  // For orders
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  // Dropdown options
  const [cuisineTypes, setCuisineTypes] = useState([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [selectedType, setSelectedType] = useState("");

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
                  // Map the array to just the 'type' string (e.g., ["Pizza", "Sushi"])
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
  }, []); // Runs once on mount


  useEffect(() => {
    if (!restaurantData) return;
    if (restaurantData.hours) {
        const parsed = parseHoursArray(restaurantData.hours);
        setHoursState(parsed);
    }
    //parse type
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
          setRestaurantData({ id: matchedDoc.id, ...matchedDoc.data() });
          setFetchingRestaurant(false);
          return;
        }

        // No existing, create new restaurant
        const newRest = {
          address: "",
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

  // This function will now handle auto-rejection AND message sending
  const updateOrderToRejected = async (restaurantId, orderId) => {
    const orderDocRef = doc(
        db,
        "restaurants",
        restaurantId,
        "restaurantOrders",
        orderId
    );

    try {
        // --- 1. READ the document to get the userId ---
        const orderSnapshot = await getDoc(orderDocRef);
        if (!orderSnapshot.exists()) {
            console.error(`Order ${orderId} not found for auto-rejection.`);
            return false; // Indicate failure
        }
        
        const orderData = orderSnapshot.data();
        const userId = orderData.userId; // Extracted the userId!

        // --- 2. UPDATE the Order Status ---
        await updateDoc(orderDocRef, {
            orderConfirmed: false,
            deliveryStatus: "Auto-rejected: Order timed out.",
        });
        
        // --- 3. SEND Message to Customer (Conditional on userId) ---
        if (userId) {
            const messagesRef = collection(db, "users", userId, "messages");
            
            await addDoc(messagesRef, {
                createdAt: serverTimestamp(), 
                message: "Order timed out and could not be fulfilled, refund sent.",
                read: false, 
                type: "order_status",
                orderId: orderId,
            });
            
            console.log(`Auto-rejection message sent to user ${userId}.`);
        }

        console.log(`Order ${orderId} auto-rejected due to timeout.`);
        return true; // Indicate success
        
    } catch (err) {
        console.error(`Failed to auto-reject order ${orderId} or send message:`, err);
        return false;
    }
  };

  // --- Realtime listener for restaurantOrders (Initial load + updates)
  useEffect(() => {
    if (!restaurantData?.id) {
      setLoadingOrders(false);
      return;
    }

    const ordersRef = collection(
      db,
      "restaurants",
      restaurantData.id,
      "restaurantOrders"
    );

    setLoadingOrders(true);

    // This listener fires once on subscription (initial load) and on every update
    const unsub = onSnapshot(ordersRef, async (snapshot) => {
      let fetchedOrders = snapshot.docs.map((docSnap) => ({
        orderId: docSnap.id,
        ...docSnap.data(),
      }));

      const now = new Date(); // The currentTime variable
      
      console.log("--- Initial Load/Realtime Update Log (onSnapshot) ---");
      console.log("Current Time (now):", now.toLocaleString()); // currentTime
      
      const autoRejectPromises = [];

      // Find unhandled orders that are past their timeout
      const timedOutOrders = fetchedOrders.filter(order => {
        const timeout = order.orderTimeout?.toDate?.() || new Date(order.orderTimeout);
        
        // Log the variables for every unconfirmed order
        console.log(`Order ${order.orderId}:`);
        console.log("  orderTimeout:", timeout ? timeout.toLocaleString() : 'N/A'); // orderTimeout
        console.log("  deliveryStatus:", order.deliveryStatus); // deliveryStatus
        console.log("  orderConfirmed:", order.orderConfirmed); // orderConfirmed
        
        // Auto-rejection logic check
        const shouldReject = timeout < now && order.orderConfirmed === null;
        if (shouldReject) {
            console.log(`!!! Order ${order.orderId} is TIMED OUT and UNHANDLED.`);
        }

        return shouldReject;
      });

      // 1. Trigger ALL necessary Firestore updates in parallel
      timedOutOrders.forEach(order => {
        autoRejectPromises.push(updateOrderToRejected(restaurantData.id, order.orderId));
      });

      // Wait for all Firestore updates to complete (optional, but ensures console logs finish)
      await Promise.all(autoRejectPromises);

      // 2. IMPORTANT: Immediately update the local state to reflect the rejection
      if (timedOutOrders.length > 0) {
        fetchedOrders = fetchedOrders.map(order => {
          if (timedOutOrders.some(tOrder => tOrder.orderId === order.orderId)) {
            // Update the local object with the rejected status
            return {
              ...order,
              orderConfirmed: false,
              deliveryStatus: "Auto-rejected: Order timed out."
            };
          }
          return order;
        });
      }

      // Set the final state
      setOrders(fetchedOrders);
      setLoadingOrders(false);
    }, (error) => {
      console.error("Error listening to orders:", error);
      setError("Error fetching orders.");
      setLoadingOrders(false);
    });

    return () => unsub(); // Cleanup listener on unmount/dependency change
  }, [restaurantData?.id]);

  // --- Running check for orders that are approaching/past timeout (every 10 seconds)
  useEffect(() => {
    if (!restaurantData?.id) return;

    const interval = setInterval(() => {
      const now = new Date(); // The currentTime variable

      console.log("--- Running Interval Check (setInterval) ---");
      console.log("Current Time (now):", now.toLocaleString()); // currentTime
      
      orders.forEach((order) => {
        // Only check unconfirmed orders
        if (order.orderConfirmed === null) {
          const timeout = order.orderTimeout?.toDate?.() || (order.orderTimeout ? new Date(order.orderTimeout) : null);
          // Log the variables
          console.log(`Order ${order.orderId}:`);
          console.log("  orderTimeout:", timeout ? timeout.toLocaleString() : 'N/A'); // orderTimeout
          console.log("  deliveryStatus:", order.deliveryStatus); // deliveryStatus
          console.log("  orderConfirmed:", order.orderConfirmed); // orderConfirmed
          
          if (timeout && timeout < now) {
            console.log(`!!! Order ${order.orderId} is TIMED OUT, initiating rejection.`);
            updateOrderToRejected(restaurantData.id, order.orderId);
          }
        }
      });
    }, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [restaurantData?.id, orders]);

  
  const handleConfirmOrder = async (orderId) => {
    try {
      const orderDocRef = doc(
        db,
        "restaurants",
        restaurantData.id,
        "restaurantOrders",
        orderId
      );

      // Get restaurant’s location
      const restLat = restaurantData.location.latitude;
      const restLng = restaurantData.location.longitude;

      // Fetch all couriers (or better, a filtered subset)
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

      // Now update the order including courierArray
      await updateDoc(orderDocRef, {
        orderConfirmed: true,
        deliveryStatus: "Confirmed, order being prepared.",
        courierArray: courierArray,
      });

      // Update local state
      setOrders((prev) =>
        prev.map((o) =>
          o.orderId === orderId
            ? {
                ...o,
                orderConfirmed: true,
                deliveryStatus: "Confirmed, order being prepared.",
                courierArray: courierArray,
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
        restaurantData.id, // Assuming restaurantData is in scope
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
        const userId = orderData.userId; // <-- Extracted the userId!

        if (!userId) {
            console.error(`userId not found on order ${orderId}. Cannot notify customer.`);
            // Proceed with order rejection but skip notification
            // ... (optional: log or alert manager)
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

  // Rendering
  if (loadingAuth || fetchingRestaurant) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (error)
    return (
      <div className="p-6 text-red-600 font-semibold">
        Error: {error}
      </div>
    );
  
  const unhandledOrders = orders.filter(order => order.orderConfirmed == null || order.orderConfirmed === false);
  const confirmedOrders = orders.filter(order => order.orderConfirmed === true);

return (
  <div className="flex min-h-screen">
    <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

    <div className="flex-grow p-6">
      <h1 className="text-3xl font-bold mb-6">
        Restaurant Manager Dashboard
      </h1>
      <h2 className="text-2xl font-bold mb-6">
        Welcome, {user.displayName || user.email} (Restaurant Manager)
      </h2>

      {/* 🔥 CONDITIONAL RENDERING based on activeTab */}

      {/* ======================================= */}
      {/* 1. Restaurant Info Tab (activeTab === "info") */}
      {/* ======================================= */}
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
          {/* Note: The onSubmit logic and variables (geocodeAddress, GeoPoint, formatHoursForFirestore, etc.)
                must be defined in the component scope for this to work. */}
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

      {/* ======================================= */}
      {/* 2. Menu Management Tab (activeTab === "menu") */}
      {/* ======================================= */}
      {activeTab === "menu" && (
        <>
          <h2 className="text-2xl font-semibold mb-4">
            Menu Management
          </h2>

          {/* Add new menu item Form */}
          {/* Note: The state/variables like newMenuItem, setNewMenuItem, db, doc, updateDoc 
              must be defined in the component scope for this to work. */}
          <form
            className="mt-6 space-y-4 bg-gray-50 p-4 rounded shadow max-w-2xl"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newMenuItem.name || !newMenuItem.price) {
                alert("Name & price required");
                return;
              }
              const item = {
                ...newMenuItem,
                calories: newMenuItem.calories ? parseInt(newMenuItem.calories) : null,
                price: parseFloat(newMenuItem.price),
                prepTime: newMenuItem.prepTime ? parseInt(newMenuItem.prepTime) : null,
              };

              const updatedMenu = [...(restaurantData.menu || []), item];

              const docRef = doc(db, "restaurants", restaurantData.id);
              try {
                await updateDoc(docRef, { menu: updatedMenu });
                setRestaurantData((prev) => ({
                  ...prev,
                  menu: updatedMenu,
                }));
                setNewMenuItem({
                  name: "",
                  description: "",
                  calories: "",
                  price: "",
                  prepTime: "",
                  imgUrl: "",
                  available: true,
                });
                alert("Menu item added");
              } catch (err) {
                console.error("Add menu item error:", err);
                alert("Failed to add menu item");
              }
            }}
          >
            <h3 className="text-xl font-semibold border-b pb-2">Add New Menu Item</h3>
            <input
              type="text"
              placeholder="Name"
              value={newMenuItem.name}
              onChange={(e) =>
                setNewMenuItem((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full border px-3 py-2 rounded"
              required
            />
            <textarea
              placeholder="Description"
              value={newMenuItem.description}
              onChange={(e) =>
                setNewMenuItem((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              className="w-full border px-3 py-2 rounded"
              rows="2"
            />
            <div className="grid grid-cols-2 gap-4">
              <input
                type="number"
                placeholder="Calories"
                value={newMenuItem.calories}
                onChange={(e) =>
                  setNewMenuItem((prev) => ({
                    ...prev,
                    calories: e.target.value,
                  }))
                }
                className="border px-3 py-2 rounded"
              />
              <input
                type="number"
                placeholder="Price"
                step="0.01"
                value={newMenuItem.price}
                onChange={(e) =>
                  setNewMenuItem((prev) => ({
                    ...prev,
                    price: e.target.value,
                  }))
                }
                className="border px-3 py-2 rounded"
                required
              />
              <input
                type="number"
                placeholder="Prep Time (min)"
                value={newMenuItem.prepTime}
                onChange={(e) =>
                  setNewMenuItem((prev) => ({
                    ...prev,
                    prepTime: e.target.value,
                  }))
                }
                className="border px-3 py-2 rounded"
              />
              <input
                type="text"
                placeholder="Image URL"
                value={newMenuItem.imgUrl}
                onChange={(e) =>
                  setNewMenuItem((prev) => ({ ...prev, imgUrl: e.target.value }))
                }
                className="border px-3 py-2 rounded"
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newMenuItem.available}
                onChange={(e) =>
                  setNewMenuItem((prev) => ({
                    ...prev,
                    available: e.target.checked,
                  }))
                }
              />
              <span className="font-medium text-gray-700">Available</span>
            </label>
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 w-full font-medium"
            >
              Add Item to Menu
            </button>
          </form>

          {/* Current Menu Display */}
          {restaurantData.menu && restaurantData.menu.length > 0 && (
            <div className="mt-10">
              <h3 className="text-xl font-semibold mb-4 border-b pb-2">Current Menu Items ({restaurantData.menu.length})</h3>
              <ul className="space-y-4">
                {restaurantData.menu.map((item, idx) => (
                  <li
                    key={idx}
                    className="border rounded p-4 flex flex-col sm:flex-row sm:items-start gap-4 bg-white shadow-md hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start space-x-4 w-full">
                      {item.imgUrl && (
                        <img
                          src={item.imgUrl}
                          alt={item.name}
                          style={{ width: "100px", height: "100px", objectFit: "cover" }}
                          className="rounded flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) =>
                            setRestaurantData((prev) => {
                              const newMenu = [...prev.menu];
                              newMenu[idx] = { ...newMenu[idx], name: e.target.value };
                              return { ...prev, menu: newMenu };
                            })
                          }
                          className="font-semibold w-full border px-2 py-1 rounded"
                        />
                        <textarea
                          value={item.description}
                          onChange={(e) =>
                            setRestaurantData((prev) => {
                              const newMenu = [...prev.menu];
                              newMenu[idx] = { ...newMenu[idx], description: e.target.value };
                              return { ...prev, menu: newMenu };
                            })
                          }
                          className="text-sm w-full border px-2 py-1 rounded"
                          rows="2"
                        />
                        <div className="flex gap-2">
                           <input
                            type="number"
                            value={item.calories}
                            onChange={(e) =>
                              setRestaurantData((prev) => {
                                const newMenu = [...prev.menu];
                                newMenu[idx] = { ...newMenu[idx], calories: e.target.value };
                                return { ...prev, menu: newMenu };
                              })
                            }
                            placeholder="Calories"
                            className="text-sm w-full border px-2 py-1 rounded"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={item.price}
                            onChange={(e) =>
                              setRestaurantData((prev) => {
                                const newMenu = [...prev.menu];
                                newMenu[idx] = { ...newMenu[idx], price: e.target.value };
                                return { ...prev, menu: newMenu };
                              })
                            }
                            placeholder="Price"
                            className="text-sm w-full border px-2 py-1 rounded"
                          />
                          <input
                            type="number"
                            value={item.prepTime}
                            onChange={(e) =>
                              setRestaurantData((prev) => {
                                const newMenu = [...prev.menu];
                                newMenu[idx] = { ...newMenu[idx], prepTime: e.target.value };
                                return { ...prev, menu: newMenu };
                              })
                            }
                            placeholder="Prep Time"
                            className="text-sm w-full border px-2 py-1 rounded"
                          />
                        </div>
                        <input
                          type="text"
                          value={item.imgUrl}
                          onChange={(e) =>
                            setRestaurantData((prev) => {
                              const newMenu = [...prev.menu];
                              newMenu[idx] = { ...newMenu[idx], imgUrl: e.target.value };
                              return { ...prev, menu: newMenu };
                            })
                          }
                          placeholder="Image URL"
                          className="text-sm w-full border px-2 py-1 rounded"
                        />

                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={item.available}
                            onChange={(e) =>
                              setRestaurantData((prev) => {
                                const newMenu = [...prev.menu];
                                newMenu[idx] = {
                                  ...newMenu[idx],
                                  available: e.target.checked,
                                };
                                return { ...prev, menu: newMenu };
                              })
                            }
                          />
                          <span className="font-medium text-gray-700">Available</span>
                        </label>

                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => {
                              const updatedMenu = restaurantData.menu.map((mi, i) =>
                                i === idx
                                  ? {
                                      ...mi,
                                      // Convert string values back to numbers for Firestore/state consistency
                                      calories: mi.calories ? parseInt(mi.calories) : null,
                                      price: parseFloat(mi.price),
                                      prepTime: mi.prepTime ? parseInt(mi.prepTime) : null,
                                    }
                                  : mi
                              );
                              const docRef = doc(db, "restaurants", restaurantData.id);
                              updateDoc(docRef, { menu: updatedMenu })
                                .then(() => {
                                  alert("Menu item updated successfully!");
                                  // Update the state with the correctly formatted numbers
                                  setRestaurantData((prev) => ({
                                    ...prev,
                                    menu: updatedMenu,
                                  }));
                                })
                                .catch((err) => {
                                  console.error("Update menu error:", err);
                                  alert("Failed updating menu");
                                });
                            }}
                            className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
                          >
                            Update
                          </button>
                          <button
                            onClick={() => {
                              const updatedMenu = restaurantData.menu.filter(
                                (_, i) => i !== idx
                              );
                              const docRef = doc(db, "restaurants", restaurantData.id);
                              updateDoc(docRef, { menu: updatedMenu })
                                .then(() => {
                                  alert("Deleted menu item");
                                  setRestaurantData((prev) => ({
                                    ...prev,
                                    menu: updatedMenu,
                                  }));
                                })
                                .catch((err) => {
                                  console.error("Delete menu error:", err);
                                  alert("Failed deleting menu item");
                                });
                            }}
                            className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* ======================================= */}
      {/* 3. Order Management Tab (activeTab === "orders") */}
      {/* ======================================= */}
      {activeTab === "orders" && (
        <>
          <h2 className="text-2xl font-semibold mb-4">
            Order Management ({unhandledOrders.length} New)
          </h2>

          <div className="mt-10">
            <h3 className="text-xl font-semibold mb-4 border-b pb-2">New Orders Awaiting Confirmation</h3>
            {/* Note: loadingOrders, unhandledOrders, handleConfirmOrder, and handleRejectOrder must be available in scope */}
            {loadingOrders ? (
              <p>Loading orders…</p>
            ) : unhandledOrders.length === 0 ? (
              <p className="text-gray-500">No new orders awaiting confirmation. 🥳</p>
            ) : (
              <div className="space-y-4">
                {unhandledOrders.map((order) => (
                  <div
                    key={order.orderId}
                    className="border-2 border-red-300 rounded p-4 bg-white shadow-lg"
                  >
                    <p className="text-sm text-gray-600">
                      <strong>Order ID:</strong> {order.orderId}
                    </p>
                    <p>
                      <strong>Status:</strong> <span className="font-medium text-red-600">{order.deliveryStatus}</span>
                    </p>
                    <p className="mb-2">
                      <strong>Order Placed:</strong>{" "}
                      {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : 'N/A'}
                    </p>
                    
                    <h4 className="font-semibold mt-3">Items:</h4>
                    <ul className="ml-4 list-disc text-sm">
                      {order.items?.map((item, i) => (
                        <li key={i} className="py-0.5">
                          {item.name} × **{item.quantity}** (Prep: {item.prepTime} min)
                        </li>
                      ))}
                    </ul>

                    {/* Conditional Buttons: ONLY show for unhandled orders (null or undefined) */}
                    {order.orderConfirmed == null && (
                      <div className="mt-4 flex space-x-3">
                        <button
                          onClick={() => handleConfirmOrder(order.orderId)}
                          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-medium transition-colors"
                        >
                          ✅ Accept Order
                        </button>
                        <button
                          onClick={() => handleRejectOrder(order.orderId)}
                          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-medium transition-colors"
                        >
                          ❌ Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <hr className="my-8 border-t-2 border-gray-300" />
          
          <div className="mt-10">
            <h3 className="text-xl font-semibold mb-4 border-b pb-2">Orders Awaiting Pickup</h3>
            {/* Note: confirmedOrders should also be available in scope */}
            {loadingOrders ? (
              <p>Loading orders…</p>
            ) : confirmedOrders.length === 0 ? (
              <p className="text-gray-500">No orders currently awaiting pickup.</p>
            ) : (
              <div className="space-y-4">
                {confirmedOrders.map((order) => (
                  <div
                    key={order.orderId}
                    className="border-2 border-green-500 rounded p-4 bg-green-50 shadow-md"
                  >
                    <p className="text-sm text-gray-600">
                      <strong>Order ID:</strong> {order.orderId}
                    </p>
                    <p>
                      <strong>Status:</strong> <span className="font-medium text-green-700">{order.deliveryStatus}</span>
                    </p>
                    <p>
                      <strong>Courier ID:</strong> {order.courierId || 'Awaiting Courier'}
                    </p>
                    <p className="mb-2">
                      <strong>Estimated Ready:</strong>{" "}
                      {order.estimatedReadyTime?.toDate().toLocaleString()}
                    </p>
                    
                    <h4 className="font-semibold mt-3">Items:</h4>
                    <ul className="ml-4 list-disc text-sm">
                      {order.items?.map((item, i) => (
                        <li key={i} className="py-0.5">
                          {item.name} × **{item.quantity}** (Prep: {item.prepTime} min)
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ======================================= */}
      {/* 4. Settings Tab (activeTab === "settings") */}
      {/* ======================================= */}
      {activeTab === "settings" && (
        <>
          <h2 className="text-2xl font-semibold mb-4">
            Account and General Settings
          </h2>
          <p className="text-gray-600">
            *Placeholder for account management, password change, notification preferences, etc.*
          </p>
        </>
      )}
    </div>
  </div>
);
}
/*
**** The accepted orders under heading "Orders awaiting pickup"
       * button "Pick-up completed" pressed -> deliveryStatus: "order being delivered" (hypothetical: on courier arrival, courierId match)


* Server (24/7) tasks:
* clients need to go through server to access database
~All restaurantOrders: updates orderTimeout periodically (currently: each restaurant is doing this client side, doesn't work if the client restaurant not online)
~All restaurantOrders: a simple periodically updating function that assigns orders to multiple couriers based on (currently: each restaurant is doing this client side, doesn't work if the client restaurant not online);
- Need a rejectedArray if courier rejects
- Need a periodic courierArray updater that checks against rejectedArray and only updates if courierId = ""
- If no available couriers, reassign to rejectedArray with higher earning
* courierArray created to find all nearby couriers available for order (should be admin server job for orderConfirmed=true orders and updated consistently)


* Later: Delete profile field (top right nav user UI)
* Later: Add a precise location pointer on clicking the map (reason: the geolocator is not that precise)
* Later: restaurant must show orders (have a confirm & reject button) -> orderConfirmed: null; Status: awaiting restaurant confirmation
         confirm -> orderConfirmed = True -> deliveryStatus: "order confirmed, being prepared" [DONE]
         reject -> orderConfirmed = False -> deliveryStatus: "order rejected" [DONE]
         timeout -> deliveryStatus: "order rejected" (needs to be a central server running 24/7 [admin] that handles order rejection to work properly)
         on rejection, orderConfirmed = false -> message sent to userId in /users/{userId}/messages/message
         -> createdAt = current time; message = "Order could not be fulfilled, refund sent" [DONE]; 
         -> possibly a copy of each message in a new collection of stored messages to view all later [LATER]
         -> send refund [LATER]
* Maybe: field to upload logo that appears on map
* Advanced: If restaurant does not accept the order -> refund user if not accepted


# Design reasons 
A. The reason orders are in systemFiles and not restaurant:
1. the number of restaurantOrders & completedOrders could get very large -> large document
2. restaurantOrders array are constantly added to / deleted keeping it a managable size
3. completedOrders is the only "infinite" size document, rarely accessed. Can be ordered and searched quickly by createdAt date, courierId, restaurantId, userId.
* these could be broken up further to reduce size (by date or restaurantId or restaurantId & date)
B. validity of address is "enforced" by the restaurant manager wanting sales. Advanced: further enforced by a courier message to admin if unable to access site.


# Reused components:
UserPage & RestaurantPage // ADDRESS to GEOLOCATION: OpenCage API 
// -> async function geocodeAddress(address) { ...
UserPage & RestaurantPage // distance calculation to find: restaurants within user location & couriers within restaurant location
// -> function getDistanceInKm(lat1, lon1, lat2, lon2) { ...

*/

