import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
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
import "../App.css";

import homeIcon from "../assets/home.svg";
import messagesIcon from "../assets/messages.svg";
import settingsIcon from "../assets/settings.svg";
import ordersIcon from "../assets/orders.svg";
import defaultProfileImg from "../assets/defaultProfile.svg";
import editIcon from "../assets/edit.svg";
import HomeTab from "../components/UserPage/homeTab";
import MessageTab from "../components/UserPage/messageTab";
import SettingTab from "../components/UserPage/settingTab";
import OrderTab from "../components/UserPage/orderTab";

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

    const fetchOrCreateUser = async () => {
      try {
        const uid = user.uid; // Get the Firebase Auth UID
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
      // keep deliveryLocation in sync (optional; remove if you don't geocode)
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
        {activeTab === "orders" && <OrderTab userOrders={userOrders} />}

        {activeTab === "settings" && (
          <SettingTab
            defaultProfileImg={defaultProfileImg}
            editIcon={editIcon}
            nameInput={nameInput}
            setNameInput={setNameInput}
            emailInput={emailInput}
            setEmailInput={setEmailInput}
            phoneInput={phoneInput}
            setPhoneInput={setPhoneInput}
            addressInput={addressInput}
            setAddressInput={setAddressInput}
            savingProfile={savingProfile}
            onSubmit={handleProfileSubmit}
          />
        )}

        {activeTab === "home" && (
          <HomeTab
            userLatLng={userLatLng}
            filteredRestaurants={filteredRestaurants}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filters={filters}
            setFilters={setFilters}
            clearTypes={clearTypes}
            toggleType={toggleType}
            searchRadius={searchRadius}
            currentDateTime={currentDateTime}
            navigate={navigate}
            setSearchRadius={setSearchRadius}
          />
        )}

        {activeTab === "messages" && <MessageTab userMessages={userMessages} />}
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
