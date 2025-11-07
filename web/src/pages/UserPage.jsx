import { useEffect, useState, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  updateDoc,
  GeoPoint,
  Timestamp,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { Navigate, useNavigate } from "react-router-dom";
import "../App.css";
import { isRestaurantOpenToday } from "../utils/isRestaurantOpenToday.js";
import { updateOrderToRejected } from "../utils/updateOrderToRejected.js";
import { geocodeAddress } from "../utils/geocodeAddress.js";
import { getDistanceInKm } from "../utils/getDistanceInKm.js";

import defaultProfileImg from "../assets/defaultProfile.svg";
import editIcon from "../assets/edit.svg";
import HomeTab from "../components/UserPage/homeTab";
import MessageTab from "../components/UserPage/messageTab";
import SettingTab from "../components/UserPage/settingTab";
import OrderTab from "../components/UserPage/orderTab";
import Sidebar from "../components/UserPage/sideBar";

import { dummyRestaurants } from "../assets/dummyRestaurants.js";

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
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [restaurantsWithActiveOrders, setRestaurantsWithActiveOrders] = useState({});
    
  const clearFormMessages = () => {
    setFormError("");
    setFormSuccess("");
  };

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

        setAllRestaurants([...fetched, ...dummyRestaurants]);
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
        return { ...r, distance: distance};
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

  const processingOrdersRef = useRef(new Set());

  //Processing rejected orders
  useEffect(() => {
    if (!userData?.id || allRestaurants.length === 0) return;
    const unsubscribers = [];
    
    for (const restaurant of allRestaurants) {
      const ordersRef = collection(db, "restaurants", restaurant.id, "restaurantOrders");

      const unsub = onSnapshot(ordersRef, async (snapshot) => {
        const now = new Date();
        const fetchedOrders = [];
        
        for (const docSnap of snapshot.docs) {
          const orderId = docSnap.id;
          const orderData = docSnap.data();
          if (orderData.userId !== userData.id) continue;

          const timeout =
            orderData.orderTimeout?.toDate?.() ||
            (orderData.orderTimeout ? new Date(orderData.orderTimeout) : null);

          const shouldReject =
            timeout && orderData.orderConfirmed === null && timeout < now;

          if (shouldReject) {
            if (processingOrdersRef.current.has(orderId)) {
              console.log(`⏩ Order ${orderId} is already being processed. Skipping re-trigger.`);
              continue;
            }
            console.log(`⏰ Initiating auto-reject for timed-out order ${orderId}`);

            processingOrdersRef.current.add(orderId);
            setUserOrders((prev) =>
              prev.map((o) =>
                o.orderId === orderId
                  ? { ...o, orderConfirmed: false, deliveryStatus: "Auto-rejected: Order timed out." }
                  : o
              )
            );
            await updateOrderToRejected(restaurant.id, orderId);
            processingOrdersRef.current.delete(orderId);
            continue; 
          }

          fetchedOrders.push({
            orderId: orderId,
            fromRestaurant: restaurant.storeName,
            ...orderData,
          });
        }

        const activeOrdersForRestaurant = fetchedOrders.filter(o => 
            o.orderConfirmed !== false && o.orderCompleted !== true
        );

        setUserOrders((prev) => {
          const others = prev.filter((o) => o.fromRestaurant !== restaurant.storeName);
          return [...others, ...fetchedOrders];
        });

        setRestaurantsWithActiveOrders(prev => ({
            ...prev,
            [restaurant.id]: activeOrdersForRestaurant
        }));
      });
      unsubscribers.push(unsub);
    }
    return () => unsubscribers.forEach((u) => u());
  }, [userData?.id, allRestaurants, setUserMessages, setUserOrders]);

  // --- MESSAGE LISTENER FOR USER ---
  useEffect(() => {
    if (!userData?.id) return;
    const messagesRef = collection(db, "users", userData.id, "messages");
    const unsub = onSnapshot(
      messagesRef,
      (snapshot) => {
        const fetchedMessages = snapshot.docs.map((docSnap) => ({
          messageId: docSnap.id,
          ...docSnap.data(),
        }));
        fetchedMessages.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() || 0;
          const timeB = b.createdAt?.toMillis?.() || 0;
          return timeB - timeA;
        });
        setUserMessages(fetchedMessages);
      },
      (error) => {
        console.error("Error listening to user messages:", error);
      }
    );
    return () => unsub();
  }, [userData?.id]);

  // --- Timeout check for user-side orders ---
  useEffect(() => {
    if (!userData?.id || userOrders.length === 0) return;

    const checkAndRejectTimedOutOrders = async () => {
      const now = new Date();
      const timedOut = userOrders.filter(order => {
        const timeout = order.orderTimeout?.toDate?.() || (order.orderTimeout ? new Date(order.orderTimeout) : null);
        return timeout && timeout < now && order.orderConfirmed === null;
      });
      if (timedOut.length > 0) {
        console.log(`User-side: Found ${timedOut.length} timed-out orders.`);
        await Promise.all(
          timedOut.map(order =>
            updateOrderToRejected(order.restaurantId, order.orderId)
          )
        );
        setUserOrders(prev =>
          prev.map(o =>
            timedOut.some(t => t.orderId === o.orderId)
              ? { ...o, orderConfirmed: false, deliveryStatus: "Auto-rejected: Order timed out." }
              : o
          )
        );
      }
    };
    checkAndRejectTimedOutOrders();
    const interval = setInterval(checkAndRejectTimedOutOrders, 5000);
    return () => clearInterval(interval);
  }, [userData?.id, userOrders]);

  // Clears settings form on tab switch
  useEffect(() => {
    clearFormMessages();
  }, [activeTab]);

  // Repopulate user setting fields when switching to settings tab or when data changes
  useEffect(() => {
    if (activeTab !== "settings" || !userData) return;

    setNameInput(userData.name || user?.displayName || "");
    setEmailInput(userData.email || user?.email || "");
    setPhoneInput(userData.phone || "");
    setAddressInput(userData.address || "");
  }, [activeTab, userData, user]);

  // Reset scroll when switching tabs or applying filters/search
  useEffect(() => {
    const container = document.getElementById("scrollable-panel");
    if (container) {
      container.scrollTo({ top: 0, behavior: "auto" });
    } else {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [activeTab, filters.openNow, filters.sort, searchTerm, filters.types]);

  // Handle phone and address update form submit
  const phoneRegex = /^[0-9()+\-\s.]{7,20}$/;

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!userData || savingProfile) return;

    clearFormMessages();

    // Basic validation for new editable fields
    if (!nameInput.trim()) {
      setFormError("Please enter your name.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput.trim())) {
      setFormError("Please enter a valid email.");
      return;
    }
    if (!addressInput.trim()) {
      setFormError("Please enter your address.");
      return;
    }
    if (!phoneRegex.test(phoneInput.trim())) {
      setFormError("Please enter a valid phone number.");
      return;
    }

    setSavingProfile(true);
    setError(null);

    try {
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

      setFormSuccess("Profile updated.");
    } catch (err) {
      console.error("Failed to update profile:", err);
      setFormError("The address you entered is invalid or couldn't be found.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUserReply = async (orderId, newRestaurantNote, newOrderTimeout) => {
    if (!userData?.id) {
          console.error("User data is not available to send a reply.");
          throw new Error("User not authenticated.");
      }
      const orderToUpdate = userOrders.find(o => o.orderId === orderId);
      if (!orderToUpdate || !orderToUpdate.restaurantId) {
          console.error("Order or restaurantId not found for reply:", orderId);
          throw new Error("Order not found or incomplete data.");
      }

      // 1. Convert the plain object to a Firestore Timestamp
      const dbTimeout = new Timestamp(newOrderTimeout.seconds, newOrderTimeout.nanoseconds);
      
      try {
          const orderRef = doc(db, "restaurants", orderToUpdate.restaurantId, "restaurantOrders", orderId);
          
          // 2. Update the document with the new notes array AND the new orderTimeout
          await updateDoc(orderRef, { 
              restaurantNote: newRestaurantNote,
              orderTimeout: dbTimeout
          });

          // 3. Immediately reflect the change in the local state (userOrders)
          setUserOrders(prev => 
              prev.map(o => 
                  o.orderId === orderId 
                      ? { 
                            ...o, 
                            restaurantNote: newRestaurantNote, 
                            orderTimeout: dbTimeout
                        } 
                      : o
              )
          );
      } catch (error) {
          console.error("Error sending user reply:", error);
          throw new Error("Failed to send reply to the restaurant."); 
      }
  };

  if (loading || fetchingUser) return <div>Loading...</div>;

  if (error)
    return <div className="p-6 text-red-600 font-semibold">Error: {error}</div>;

  if (!user) return <Navigate to="/login" />;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        filters={filters}
        toggleType={toggleType}
        clearTypes={clearTypes}
      />

      <main className="flex-1 p-6 overflow-y-auto">
        {activeTab === "orders" && 
        <OrderTab 
          userOrders={userOrders}
          handleUserReply={handleUserReply}
          userId={userData?.id}
          userName={userData.name}
        />}

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
            formError={formError}
            formSuccess={formSuccess}
            onClearMessages={clearFormMessages}
          />
        )}

        {activeTab === "home" && (
          <HomeTab
            userLatLng={userLatLng}
            filteredRestaurants={filteredRestaurants}
            restaurantsWithActiveOrders={restaurantsWithActiveOrders}
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
* Later: Add a precise location pointer on clicking the map (reason: the geolocator is not that precise) or just use location services
* Later: Show courier moving on map (car icon)
* Later: Do not allow orders on closed stores, do not show closed stores, do not retrieve closed stores
* Later: If a courier is not in range of the closing time of a restaurant (show the location, but do not allow orders)
* Later: To reduce LIST search results (Fetch restaurants):
    ~ 1. filter by open hours -> possibly keep, but closed are ordered to lowest on list
    ~ 2. no places with the same name after 5 occurances
* Maybe: Since anyone can create a restaurant, many can appear on the map. Preferential appearance based on totalOrders from unique userId. Advanced (restaurant): Paid preferential appearance option like Google Search.
* Maybe: Status updates from system (admin has contacted courier, admin has changed courier, estimated wait time)
* Maybe: System updates from courier (waiting for restaurant, assistance button pressed)
* Advanced: Message system to admin team if excessive wait time
* Advanced: order from multiple restaurants in one order.

# Assumes GPS is generally static, user can modify in input section
*/
