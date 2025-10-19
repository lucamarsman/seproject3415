import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  GeoPoint,
  Timestamp,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { Navigate, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "../App.css";

import homeIcon from "../assets/home.svg";
import messagesIcon from "../assets/messages.svg";
import settingsIcon from "../assets/settings.svg";
import ordersIcon from "../assets/orders.svg";
import defaultProfileImg from "../assets/defaultProfile.svg";

// MAP VIEW: React Leaflet
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
  iconAnchor: [16, 32], // half width, full height
  popupAnchor: [0, -32], // position popup above icon
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  shadowSize: [41, 41],
  shadowAnchor: [13, 41],
});

function FitBoundsView({ markers }) {
  const map = useMap();
  const [hasFit, setHasFit] = useState(false);

  useEffect(() => {
    const savedZoom = sessionStorage.getItem("userMapZoom");

    // Don't fit bounds if zoom already restored
    if (markers.length < 2 || hasFit || savedZoom) return;

    const bounds = L.latLngBounds(markers);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    setHasFit(true);
  }, [map, markers, hasFit]);

  return null;
}

function ZoomToRadius({ setSearchRadius, setMapInstance }) {
  const map = useMap();

  useEffect(() => {
    setMapInstance(map);

    function handleZoom() {
      const zoom = map.getZoom();
      const radius = zoomLevelToKm(zoom);
      setSearchRadius(radius);
      sessionStorage.setItem("userMapZoom", zoom.toString()); //save zoom level during session
    }

    map.on("zoomend", handleZoom);
    handleZoom(); // Run once on mount

    return () => {
      map.off("zoomend", handleZoom);
    };
  }, [map, setSearchRadius, setMapInstance]);

  return null;
}

function zoomLevelToKm(zoom) {
  // Leaflet zoom level to radius (km)
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
  return Math.min(radius, 100); // restaurants will not show over 100km from address
}

function MapSetTo({ position }) {
  const map = useMap();

  useEffect(() => {
    if (!position) return;

    const savedZoom = parseInt(sessionStorage.getItem("userMapZoom"));
    const currentZoom = map.getZoom();

    if (!isNaN(savedZoom)) {
      map.setView(position, savedZoom); // use saved
    } else {
      map.setView(position, currentZoom); // fallback to current
    }
  }, [position, map]);

  return null;
}

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
      throw new Error("No results found.");
    }
  } catch (err) {
    console.error("Geocoding failed:", err);
    throw err;
  }
}

// DISTANCE CALCULATION (User to restaurant)
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
  return (R * c).toFixed(2); // distance in km, rounded to 2 decimals
}

// RESTAURANT OPEN TIMES
function isRestaurantOpenToday(hoursArray, now = new Date()) {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const today = days[now.getDay()];

  const todayEntry = hoursArray.find((entry) => entry[today]);
  if (!todayEntry || !todayEntry[today]) return false;

  const { Opening, Closing } = todayEntry[today];

  if (
    !Opening ||
    !Closing ||
    Opening.length !== 4 ||
    Closing.length !== 4 ||
    Opening === Closing // ðŸ”’ Same open/close time â†’ closed
  ) {
    return false;
  }

  const openHour = parseInt(Opening.slice(0, 2), 10);
  const openMinute = parseInt(Opening.slice(2), 10);
  const closeHour = parseInt(Closing.slice(0, 2), 10);
  const closeMinute = parseInt(Closing.slice(2), 10);

  const openTime = new Date(now);
  openTime.setHours(openHour, openMinute, 0, 0);

  const closeTime = new Date(now);
  closeTime.setHours(closeHour, closeMinute, 0, 0);

  // Overnight handling
  if (closeTime <= openTime) {
    const closeTimeNextDay = new Date(closeTime);
    closeTimeNextDay.setDate(closeTimeNextDay.getDate() + 1);
    return now >= openTime || now <= closeTimeNextDay;
  }

  // Normal hours
  return now >= openTime && now <= closeTime;
}

function formatTime(timeStr) {
  if (!timeStr || timeStr.length !== 4) return "Invalid";
  const hours = timeStr.slice(0, 2);
  const minutes = timeStr.slice(2);
  return `${hours}:${minutes}`;
}

export default function UserPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [fetchingUser, setFetchingUser] = useState(true);
  const [error, setError] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [addressInput, setAddressInput] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [expandedRestaurantId, setExpandedRestaurantId] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [searchRadius, setSearchRadius] = useState(12); // default 10 km search radius
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [userLatLng, setUserLatLng] = useState([44.413922, -79.707506]); // Georgian Mall Family Dental as fallback
  const [allRestaurants, setAllRestaurants] = useState([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState([]);
  const [userOrders, setUserOrders] = useState([]);
  const [userMessages, setUserMessages] = useState([]);
  const [activeTab, setActiveTab] = useState("home");

  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    openNow: false,
    minRating: null,
    types: [],
    sort: "distance",
  });

  const toggleType = (type) => {
    setFilters((f) => {
      const exists = f.types.includes(type);
      return {
        ...f,
        types: exists ? f.types.filter((t) => t !== type) : [...f.types, type],
      };
    });
  };
  const clearTypes = () => setFilters((f) => ({ ...f, types: [] }));

  // Info for cuisine filter buttons
  const cuisineBtns = [
    { type: "Pizza", label: "Pizza", icon: "🍕" },
    { type: "Fast Food", label: "Fast Food", icon: "🍔" },
    { type: "Sushi", label: "Sushi", icon: "🍣" },
    { type: "Indian", label: "Indian", icon: "🥘" },
    { type: "Fine Dining", label: "Fine Dining", icon: "🍷" },
    { type: "Middle Eastern", label: "Middle Eastern", icon: "🍢" },
    { type: "Mexican", label: "Mexican", icon: "🌮" },
    { type: "Chinese", label: "Chinese", icon: "🥡" },
    { type: "Italian", label: "Italian", icon: "🍝" },
    { type: "Greek", label: "Greek", icon: "🥙" },
    { type: "BBQ", label: "BBQ", icon: "🍖" },
    { type: "Vegan", label: "Vegan", icon: "🥗" },
  ];

  const navigate = useNavigate();

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Time updated every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch or create user document
  useEffect(() => {
    if (!user) return;

    const usersRef = collection(db, "users");

    const fetchOrCreateUser = async () => {
      try {
        const uid = user.uid; // ðŸ‘ˆ get the Firebase Auth UID
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userDoc = { id: uid, ...userSnap.data() };
          setUserData(userDoc);

          if (userDoc.deliveryLocation) {
            setUserLatLng([
              userDoc.deliveryLocation.latitude,
              userDoc.deliveryLocation.longitude,
            ]);
          }

          setNameInput(userDoc?.name || user.displayName || "");
          setEmailInput(userDoc?.email || user.email || "");
          setPhoneInput(userDoc.phone || "");
          setAddressInput(userDoc.address || "");
          setFetchingUser(false);
          return;
        }

        // Create new user doc using UID
        const newUser = {
          email: user.email,
          name: user.displayName,
          createdAt: Timestamp.fromDate(new Date()),
          deliveryLocation: new GeoPoint(44.413922, -79.707506),
          phone: "",
          address: "",
        };

        await setDoc(userRef, newUser); // uses UID as document ID

        setUserData({ id: uid, ...newUser });
        setAddressInput("");
        setFetchingUser(false);
      } catch (err) {
        console.error("Error fetching or creating user:", err);
        setError("Something went wrong while setting up your user profile.");
        setFetchingUser(false);
      }
    };
    fetchOrCreateUser();
  }, [user]);

  // Fetch restaurants
  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const snap = await getDocs(collection(db, "restaurants"));
        const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        setAllRestaurants(fetched); //all restaurants on initial fetch appear on map
        // only those restaurants user toggles with +/- appear on list (filtered by distance)
      } catch (err) {
        console.error("Error fetching restaurants:", err);
      }
    })();
  }, [user]);

  // Inside useEffect or after fetching restaurants:
  useEffect(() => {
    let filtered = allRestaurants
      .map((r) => {
        const rLat = r.location?.latitude;
        const rLng = r.location?.longitude;
        if (!rLat || !rLng) return null;
        const distance = getDistanceInKm(
          userLatLng[0],
          userLatLng[1],
          rLat,
          rLng
        );
        return { ...r, distance: parseFloat(distance) };
      })
      .filter((r) => r && r.distance <= searchRadius);

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.storeName?.toLowerCase().includes(term) ||
          r.address?.toLowerCase().includes(term)
      );
    }

    if (filters.openNow) {
      filtered = filtered.filter((r) =>
        isRestaurantOpenToday(r.hours, currentDateTime)
      );
    }

    if (filters.types?.length) {
      filtered = filtered.filter((r) => filters.types.includes(r.type));
    }

    const sorted = [...filtered];
    if (filters.sort === "distance") {
      sorted.sort((a, b) => a.distance - b.distance);
    } else if (filters.sort === "rating") {
      sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else if (filters.sort === "name") {
      sorted.sort((a, b) =>
        (a.storeName ?? "").localeCompare(b.storeName ?? "")
      );
    }

    setFilteredRestaurants(sorted);
  }, [
    allRestaurants,
    userLatLng,
    searchRadius,
    searchTerm,
    filters.openNow,
    filters.sort,
    currentDateTime,
    filters.types,
  ]);

  //ORDERS FOR USER
  useEffect(() => {
    if (!userData?.id || allRestaurants.length === 0) return;

    const unsubscribers = [];
    let collectedOrders = [];

    for (const restaurant of allRestaurants) {
      const ordersRef = collection(
        db,
        "restaurants",
        restaurant.id,
        "restaurantOrders"
      );

      const unsubscribe = onSnapshot(ordersRef, (snapshot) => {
        const restaurantOrders = [];

        snapshot.forEach((docSnap) => {
          const orderData = docSnap.data();
          if (orderData.userId === userData.id) {
            restaurantOrders.push({ ...orderData, orderId: docSnap.id });
            console.log("Checking order:", {
              fromRestaurant: restaurant.storeName,
              orderUserId: orderData.userId,
              currentUserId: userData.id,
            });
          }
        });

        // Update collected orders from all restaurants
        collectedOrders = [
          ...collectedOrders.filter(
            (o) => o.fromRestaurant !== restaurant.storeName
          ),
          ...restaurantOrders.map((order) => ({
            ...order,
            fromRestaurant: restaurant.storeName,
          })),
        ];

        // Set only once all restaurants have been processed at least once
        setUserOrders([...collectedOrders]);
      });

      unsubscribers.push(unsubscribe);
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [userData?.id, allRestaurants]);

  // --- MESSAGE LISTENER FOR USER ---
  useEffect(() => {
    if (!userData?.id) return;
    const messagesRef = collection(db, "users", userData.id, "messages");

    // Setup real-time listener for messages
    const unsub = onSnapshot(
      messagesRef,
      (snapshot) => {
        const fetchedMessages = snapshot.docs.map((docSnap) => ({
          messageId: docSnap.id,
          ...docSnap.data(),
        }));
        // Sort by createdAt time descending (newest first)
        fetchedMessages.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() || 0;
          const timeB = b.createdAt?.toMillis?.() || 0;
          return timeB - timeA; // B minus A for descending (newest first)
        });
        setUserMessages(fetchedMessages);
      },
      (error) => {
        console.error("Error listening to user messages:", error);
        // Handle error fetching messages (optional)
      }
    );
    return () => unsub();
  }, [userData?.id]);

  // Handle phone and address update form submit
  const phoneRegex = /^[0-9()+\-\s.]{7,20}$/;

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!userData || savingProfile) return;

    // Basic validation for new editable fields
    if (!nameInput.trim()) {
      alert("Please enter your name.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput.trim())) {
      alert("Please enter a valid email.");
      return;
    }
    if (!addressInput.trim()) {
      alert("Please enter your address.");
      return;
    }
    if (!phoneRegex.test(phoneInput.trim())) {
      alert("Please enter a valid phone number.");
      return;
    }

    setSavingProfile(true);
    setError(null);

    try {
      // keep deliveryLocation in sync (optional; remove if you donâ€™t geocode)
      const { lat, lng } = await geocodeAddress(addressInput.trim());

      const userRef = doc(db, "users", userData.id);
      const updatedFields = {
        name: nameInput.trim(),
        email: emailInput.trim(), // stored in users doc (not Auth)
        phone: phoneInput.trim(),
        address: addressInput.trim(),
        ...(lat && lng ? { deliveryLocation: new GeoPoint(lat, lng) } : {}),
      };

      await updateDoc(userRef, updatedFields);

      // reflect locally
      setUserData((prev) => ({ ...prev, ...updatedFields }));
      if (lat && lng) setUserLatLng([lat, lng]);

      alert("Profile updated.");
    } catch (err) {
      console.error("Failed to update profile:", err);
      setError("Failed to update your profile. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading || fetchingUser) return <div>Loading...</div>;

  if (error)
    return <div className="p-6 text-red-600 font-semibold">Error: {error}</div>;

  if (!user) return <Navigate to="/login" />;

  const restaurantsWithinRange = filteredRestaurants;
  const shouldFitBounds = restaurantsWithinRange.length > 0;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-300 p-4 sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-hidden">
        <div className="flex flex-col space-y-2">
          <button
            onClick={() => setActiveTab("home")}
            className={`flex items-center gap-2 text-left px-3 py-2 rounded-md cursor-pointer transition-all
    ${
      activeTab === "home"
        ? "bg-gray-200 text-gray-800"
        : "hover:bg-gray-100 text-gray-800"
    }
  `}
          >
            <img src={homeIcon} className="w-5 h-5 object-contain" alt="Home" />
            Home
          </button>

          <button
            onClick={() => setActiveTab("messages")}
            className={`flex items-center gap-2 text-left px-3 py-2 rounded-md cursor-pointer transition-all
    ${
      activeTab === "messages"
        ? "bg-gray-200 text-gray-800"
        : "hover:bg-gray-100 text-gray-800"
    }
  `}
          >
            <img
              src={messagesIcon}
              className="w-5 h-5 object-contain"
              alt="Messages"
            />
            Messages
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 text-left px-3 py-2 rounded-md cursor-pointer transition-all
    ${
      activeTab === "settings"
        ? "bg-gray-200 text-gray-800"
        : "hover:bg-gray-100 text-gray-800"
    }
  `}
          >
            <img
              src={settingsIcon}
              className="w-5 h-5 object-contain"
              alt="Settings"
            />
            Settings
          </button>

          <button
            onClick={() => setActiveTab("orders")}
            className={`flex items-center gap-2 text-left px-3 py-2 rounded-md cursor-pointer transition-all
    ${
      activeTab === "orders"
        ? "bg-gray-200 text-gray-800"
        : "hover:bg-gray-100 text-gray-800"
    }
  `}
          >
            <img
              src={ordersIcon}
              className="w-5 h-5 object-contain"
              alt="My Orders"
            />
            My Orders
          </button>

          <hr className="my-1 border-gray-300" />
          <div className="mt-3">
            <div className="flex flex-col items-center space-y-3">
              {cuisineBtns.map(({ type, label, icon }) => {
                const active = filters.types.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      toggleType(type);
                      setActiveTab("home");
                    }}
                    className={`flex items-center justify-start w-[200px] px-2 py-0 rounded-lg border font-medium text-base transition-all cursor-pointer
          ${
            active
              ? "bg-blue-600 text-white border-blue-600 shadow-md"
              : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50 hover:shadow"
          }`}
                    aria-pressed={active}
                  >
                    <span className="inline-flex items-center justify-center w-8 h-8 mr-3 text-2xl">
                      {icon}
                    </span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-y-auto">
        {activeTab === "orders" && (
          <>
            {userOrders.filter((order) => order.orderConfirmed !== false)
              .length === 0 ? (
              <p className="text-gray-600 italic">No current orders found.</p>
            ) : (
              <div className="space-y-4">
                {userOrders
                  .filter((order) => order.orderConfirmed !== false)
                  .map((order, index) => (
                    <div
                      key={order.orderId || index}
                      className="border rounded p-4 bg-yellow-50 border-yellow-300 text-yellow-800 shadow-sm"
                    >
                      <h3 className="font-semibold text-lg mb-1">
                        Order #{index + 1}
                      </h3>
                      <p>
                        <strong>Status:</strong> {order.deliveryStatus}
                      </p>
                      <p>
                        <strong>Restaurant:</strong>{" "}
                        {order.fromRestaurant || "Restaurant"}{" "}
                        <span className="text-gray-600">
                          â€” {order.restaurantAddress}
                        </span>
                      </p>
                      <p>
                        <strong>Total:</strong> $
                        {Number(order.payment ?? 0).toFixed(2)}
                      </p>
                      {/* <p>
                        <strong>Estimated Ready Time:</strong>{" "}
                        {order.estimatedReadyTime?.toDate().toLocaleString()}
                      </p> */}
                      <p>
                        <strong>Order Date:</strong>{" "}
                        {order.createdAt?.toDate().toLocaleString()}
                      </p>
                      <div className="mt-2">
                        <strong>Items:</strong>
                        <ul className="list-disc list-inside ml-4">
                          {order.items?.map((item, idx) => (
                            <li key={idx}>
                              {item.name} (x{item.quantity})
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}

        {activeTab === "settings" && (
          <>
            <img
              src={defaultProfileImg}
              className="w-50 h-50 object-cover rounded-full m-auto"
            ></img>
            <hr className="my-8 border-t-2 border-gray-300" />
            <form onSubmit={handleProfileSubmit}>
              <table className="w-full table-fixed border border-gray-300 mt-4">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2 border-b w-1/5">
                      Field
                    </th>
                    <th className="text-left px-4 py-2 border-b">Value</th>
                  </tr>
                </thead>

                <tbody>
                  {/* Non-editable fields
                <tr>
                  <td className="px-4 py-2 border-b align-top">Name</td>
                  <td className="px-4 py-2 border-b" colSpan={2}>
                    {userData?.name || user.displayName}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 border-b align-top">Email</td>
                  <td className="px-4 py-2 border-b" colSpan={2}>
                    {userData?.email || user.email}
                  </td>
                </tr> */}

                  {/* Editable name input */}
                  <tr>
                    <td className="px-4 py-2 border-b align-top">Name</td>
                    <td className="px-4 py-2 border-b">
                      <input
                        type="text"
                        className="border px-4 py-2 text-base rounded w-full"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        placeholder="Your full name"
                      />
                    </td>
                  </tr>

                  {/* Editable Email input */}
                  <tr>
                    <td className="px-4 py-2 border-b align-top">Email</td>
                    <td className="px-4 py-2 border-b">
                      <input
                        type="email"
                        className="border px-4 py-2 text-base rounded w-full"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="name@example.com"
                      />
                    </td>
                  </tr>

                  {/* Editable Phone input */}
                  <tr>
                    <td className="px-4 py-2 border-b align-top">Phone</td>
                    <td className="px-4 py-2 border-b">
                      <input
                        type="tel"
                        className="border px-4 py-2 text-base rounded w-full"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        placeholder="555-123-4567"
                      />
                    </td>
                  </tr>

                  {/* Editable Address input */}
                  <tr>
                    <td className="px-4 py-2 border-b align-top">Address</td>
                    <td className="px-4 py-2 border-b">
                      <input
                        type="text"
                        className="border px-4 py-2 text-base rounded w-full"
                        value={addressInput}
                        onChange={(e) => setAddressInput(e.target.value)}
                        placeholder="123 Main St, City, Country"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Single, consistent action area */}
              <div className="flex justify-end mt-3">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-5 py-2 rounded text-sm"
                  disabled={savingProfile}
                >
                  {savingProfile ? "Saving..." : "Update"}
                </button>
              </div>
            </form>
          </>
        )}

        {activeTab === "home" && (
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
                          setFilters((f) => ({
                            ...f,
                            openNow: e.target.checked,
                          }))
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
                  {filteredRestaurants.length}{" "}
                  {filteredRestaurants.length === 1 ? "result" : "results"}
                </div>
              </div>

              {filters.types.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {filters.types.map((t) => (
                    <button
                      key={t}
                      onClick={() => toggleType(t)}
                      className="px-2.5 py-1 rounded-full border text-xs bg-blue-50 border-blue-200 text-blue-700"
                      title="Remove filter"
                    >
                      {t} ×
                    </button>
                  ))}
                  <button
                    onClick={clearTypes}
                    className="text-xs text-blue-700 hover:underline"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>

            <div className="w-full rounded overflow-hidden border border-gray-300 mt-4 mb-4">
              <div className="h-72 md:h-80 lg:h-96 relative">
                <MapContainer
                  center={userLatLng}
                  zoom={parseInt(sessionStorage.getItem("userMapZoom")) || 11} //Restore session level or fallback to 11
                  scrollWheelZoom={false}
                  style={{ height: "100%", width: "100%", zIndex: 0 }}
                >
                  <MapSetTo position={userLatLng} />
                  <ZoomToRadius
                    setSearchRadius={setSearchRadius}
                    setMapInstance={setMapInstance}
                  />
                  {shouldFitBounds && (
                    <FitBoundsView
                      markers={[
                        userLatLng,
                        ...restaurantsWithinRange.map((r) => [
                          r.location.latitude,
                          r.location.longitude,
                        ]),
                      ]}
                    />
                  )}
                  <TileLayer
                    attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={userLatLng}>
                    <Popup>Your delivery location</Popup>
                  </Marker>

                  {filteredRestaurants
                    .map((r) => {
                      const rLat = r.location?.latitude;
                      const rLng = r.location?.longitude;
                      if (!rLat || !rLng) return null;

                      const distance = getDistanceInKm(
                        userLatLng[0],
                        userLatLng[1],
                        rLat,
                        rLng
                      );

                      return { ...r, distance: parseFloat(distance) };
                    })
                    .filter((r) => r && r.distance <= 100)
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
                          {r.distance.toFixed(2)} km away
                        </Popup>
                      </Marker>
                    ))}
                </MapContainer>
              </div>
            </div>

            <h2 className="mt-8 text-xl">
              Nearby Restaurants within {searchRadius} km
            </h2>

            {filteredRestaurants.length === 0 ? (
              <p className="mt-4 text-sm text-gray-600 italic">
                No restaurants match your filters.
              </p>
            ) : (
              <div
                className="
      mt-4
      grid grid-cols-1 sm:grid-cols-2      /* 2 per row on small+ screens */
      gap-4
    "
              >
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
                    className="
          text-left
          border rounded-lg shadow-sm
          bg-white hover:shadow-md transition
          p-4
          focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer
        "
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
                              { weekday: "long" }
                            );
                            const todayHours = r.hours.find(
                              (entry) => entry[dayName]
                            );
                            if (!todayHours) return "(No hours set)";
                            const opening = todayHours[dayName].Opening;
                            const closing = todayHours[dayName].Closing;
                            return `(${formatTime(opening)} - ${formatTime(
                              closing
                            )})`;
                          })()}
                        </span>
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "messages" && (
          <>
            <hr className="my-8 border-t-2 border-gray-300" />
            <h2 className="text-xl font-bold mt-8 mb-4">Messages</h2>
            {!userMessages || userMessages.length === 0 ? (
              <p className="text-gray-600 italic">No new messages.</p>
            ) : (
              <ul className="space-y-4 list-none p-0">
                {userMessages.map((msg) => (
                  <li
                    key={msg.messageId}
                    className={`border rounded p-4 shadow-sm ${
                      msg.read === false
                        ? "bg-blue-50 border-blue-300"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-semibold text-lg">{msg.message}</p>
                      <span className="text-xs text-gray-500 ml-4 whitespace-nowrap">
                        {msg.createdAt?.toDate().toLocaleString()}
                      </span>
                    </div>
                    {msg.read === false && (
                      <span className="inline-block text-xs font-medium text-blue-600">
                        NEW
                      </span>
                    )}
                    {msg.orderId && (
                      <p className="text-sm text-gray-600 mt-1">
                        Related to Order ID: {msg.orderId}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </div>
  );
}

/*
* Later: Better UI -> top right nav is UserPage user profile link (Name, email, phone* Please complete your user profile before ordering message; delete account)
* Later: replace tailwind with regular css or get tailwind working
* Later: Add a precise location pointer on clicking the map (reason: the geolocator is not that precise) or just use location services
* Later: Special restaurant instructions (allergy)
* Later: Special courier instructions (gated entry password...)
* Later: Show courier moving on map (car icon)
* Later: Do not allow orders on closed stores, do not show closed stores, do not retrieve closed stores
* Later: If a courier is not in range of the closing time of a restaurant (show the location, but do not allow orders)
* Later: To reduce LIST search results (Fetch restaurants):
    ~ 1. filter all by distance (max distance up to 100km) -> Done with toggling +/- âœ…
    ~ 2. filter by open hours -> possibly keep, but closed are ordered to lowest on list
    ~ 3. no places with the same name after 5 occurances
* Maybe: Since anyone can create a restaurant, many can appear on the map. Preferential appearance based on totalOrders from unique userId. Advanced (restaurant): Paid preferential appearance option like Google Search.
* Maybe: Status updates from system (admin has contacted courier, admin has changed courier, estimated wait time)
* Maybe: System updates from courier (waiting for restaurant, assistance button pressed)
* Advanced: Message system to admin team if excessive wait time
* Advanced: order from multiple restaurants in one order.


# Assumes GPS is generally static, user can modify in input section
# Search radius: start local at 25km (small selection -> limited search results)
                 max distance at 100km (some people might want specialty takeout -> issue with ordering large amount of results)
*/
