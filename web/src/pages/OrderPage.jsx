import { useEffect, useState } from "react";
import { onAuthStateChanged, getAuth } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, GeoPoint, Timestamp, increment } from "firebase/firestore";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { auth, db } from "../firebase";
import { isRestaurantOpenToday } from "../utils/isRestaurantOpenToday.js";
import { isRestaurantAcceptingOrders } from "../utils/isRestaurantAcceptingOrders.js";

import defaultImage from "../assets/defaultImgUrl.png";
const DEFAULT_IMAGE_URL = defaultImage;


export default function OrderPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { restaurantId } = useParams();
  const restaurant = location.state?.restaurant;
  const [quantities, setQuantities] = useState({});
  const [total, setTotal] = useState(0);
  const [userId, setUserId] = useState(null);
  const [userData, setUserData] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [userDataLoaded, setUserDataLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // SINGLE auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), async (user) => {
      setAuthChecked(true);

      if (user) {
        setUserId(user.uid);
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserData(userSnap.data());
        } else {
          console.warn("No user document found");
        }
      } else {
        navigate("/login");
      }
      setUserDataLoaded(true);
    });

    return () => unsubscribe();
  }, [navigate]);

  // Redirect if no restaurant
  useEffect(() => {
    if (!restaurant) {
      navigate("/user");
    }
  }, [restaurant, navigate]);

  // Calculate total price
  useEffect(() => {
    if (!restaurant?.menu) return;
    const newTotal = restaurant.menu.reduce((acc, item, idx) => {
      if (item.available) {
        const qty = quantities[idx] || 0;
        acc += item.price * qty;
      }
      return acc;
    }, 0);
    setTotal(newTotal);
  }, [quantities, restaurant]);

  const handleQuantityChange = (index, value) => {
    const qty = parseInt(value, 10);
    if (isNaN(qty) || qty < 0) return;
    setQuantities((prev) => ({
      ...prev,
      [index]: qty,
    }));
  };

  const handleSubmitOrder = async () => {
    if (isSubmitting) {
      console.log("Order submission already in progress. Ignoring duplicate click.");
      return;
    }
    setIsSubmitting(true);
    if (!isRestaurantOpenToday(restaurant.hours, new Date())) {
      alert("Store is currently closed. Please try during open hours.");
      return;
    }

    if (!isRestaurantAcceptingOrders(restaurant.autoSetting)) {
      alert("Store is currently not accepting orders.");
      return;
    }

    if (total === 0) {
      alert("Please add at least one item to your order.");
      return;
    }

    if (!userData?.deliveryLocation) {
      alert("Missing user location.");
      return;
    }

    if (!userData?.address) {
      alert("Missing user address.");
      return;
    }

    try {
      // Step 1: Get restaurant doc to read totalOrders
      const restaurantRef = doc(db, "restaurants", restaurantId);
      const restaurantSnap = await getDoc(restaurantRef);

      if (!restaurantSnap.exists()) {
        alert("Restaurant not found.");
        return;
      }

      const restaurantData = restaurantSnap.data();
      const currentTotalOrders = restaurantData.totalOrders || 0;

      // Step 2: Generate unique orderId
      const orderId = `${restaurantId}_${currentTotalOrders}`;

      // Step 3: Prepare order items
      const items = Object.entries(quantities)
        .filter(([idx, qty]) => qty > 0 && restaurant.menu[idx])
        .map(([idx, qty]) => ({
          name: restaurant.menu[idx].name,
          quantity: qty,
          prepTime: restaurant.menu[idx].prepTime || 0,
        }));

      // Setting time based variables
      const totalPrepTime = items.reduce(
        (sum, item) => sum + (item.prepTime || 0) * item.quantity,
        0
      );
      const estimatedReadyDate = new Date();
      estimatedReadyDate.setMinutes(estimatedReadyDate.getMinutes() + totalPrepTime);
      const createdAt = Timestamp.now();
      const orderTimeout = Timestamp.fromMillis(createdAt.toMillis() + 15000);

      // Step 4: Construct the order document
      const newOrder = {
        createdAt: createdAt,
        courierArray: [],
        courierRejectArray: [],
        courierConfirmed: false,
        courierId: "",
        orderTimeout: orderTimeout,
        deliveryStatus: "Awaiting restaurant confirmation.",
        orderConfirmed: null,
        orderId,
        restaurantId,
        userId,
        items,
        payment: total,
        totalPrepTime,
        estimatedReadyTime: Timestamp.fromDate(estimatedReadyDate),
        restaurantAddress: restaurant.address || "",
        restaurantLocation: restaurant.location,
        userAddress: userData.address,
        userLocation: userData.deliveryLocation,
      };

      // Step 5: Save to /restaurants/{restaurantId}/restaurantOrders/{orderId}
      const orderRef = doc(db, "restaurants", restaurantId, "restaurantOrders", orderId);
      await setDoc(orderRef, newOrder);

      // Step 6: Increment totalOrders on the restaurant doc
      await updateDoc(restaurantRef, {
        totalOrders: increment(1),
      });      

      // Step 7: Navigate after successful order
      navigate("/user", {
        state: {
          total,
          restaurantName: restaurant.storeName,
          items,
        },
      });

    } catch (error) {
      console.error("Error submitting order:", error);
      alert("There was an error processing your order. Please try again.");
      setIsSubmitting(false);
    }
  };

  // LOADING SCREEN CHECKS
  if (!authChecked) {
      return <div className="p-6 text-center text-xl">Checking authentication...</div>;
  }
  if (!userId) {
      return null; 
  }
  if (!restaurant) {
      return <div className="p-6 text-center text-xl">Loading restaurant details...</div>;
  }
  if (!userDataLoaded) {
      return <div className="p-6 text-center text-xl">Loading your user profile...</div>;
  }
  if (!userData?.deliveryLocation || !userData?.address) {
      return (
          <div className="p-6 max-w-4xl mx-auto text-center border-red-500 border-2 rounded-lg py-12">
              <h2 className="text-2xl font-bold text-red-600 mb-4">Location Missing 📍</h2>
              <p className="text-lg text-gray-700">
                  It looks like your delivery location or address is missing from your profile. 
                  Please update your settings to proceed with the order.
              </p>
              <button
                  onClick={() => navigate('/settings')}
                  className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
              >
                  Go to Settings
              </button>
          </div>
      );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        Order from {restaurant.storeName}
      </h1>

      {!restaurant.menu?.some(item => item.available) ? (
        <p>No menu items available.</p>
      ) : (
        <form onSubmit={(e) => {
          e.preventDefault();
          handleSubmitOrder();
        }}>
          <ul className="space-y-4">
            {restaurant.menu.map((item, index) => {
              if (!item.available) return null;

              return (
                <li key={index} className="border rounded p-4 flex gap-4 items-start shadow-sm">
                  <img
                    src={item.imgUrl || DEFAULT_IMAGE_URL} 
                    alt={item.name}
                    style={{ width: "100px", height: "100px", objectFit: "cover" }}
                    className="rounded"
                    onError={(e) => {
                      if (e.currentTarget.src !== DEFAULT_IMAGE_URL) {
                        e.currentTarget.src = DEFAULT_IMAGE_URL;
                      }
                    }}
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="text-sm text-gray-600">{item.description}</p>
                    <p className="text-sm text-gray-500">Calories: {item.calories}</p>
                    <p className="text-sm font-medium mb-2">${item.price.toFixed(2)}</p>
                    <input
                      type="number"
                      min="0"
                      className="w-24 border px-2 py-1 rounded"
                      value={quantities[index] || ""}
                      onChange={(e) => handleQuantityChange(index, e.target.value)}
                      placeholder="Qty"
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 text-right">
            <p className="text-lg font-bold mb-2">Total: ${total.toFixed(2)}</p>
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              Pay & Submit
            </button>
          </div>
        </form>
      )}
    </div>
  );
}


/*
* Later: add payment -> create order -> split between: 
         ~ Restaurant:	        Food revenue (minus platform commission)
         ~ Delivery Driver:	    Delivery fee + tip (via platform)
         ~ Platform (Delivery):	Commission + service fees
*/