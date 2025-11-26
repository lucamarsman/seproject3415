import { useEffect, useState } from "react";
import { onAuthStateChanged, getAuth } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, Timestamp, increment } from "firebase/firestore";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { auth, db } from "../firebase";

import { coordinateFormat } from "../utils/coordinateFormat.js"; // utils
import { isRestaurantOpenToday } from "../utils/isRestaurantOpenToday.js";
import { isRestaurantAcceptingOrders } from "../utils/isRestaurantAcceptingOrders.js";

import defaultImage from "../assets/defaultImgUrl.png"; // assets

const DEFAULT_IMAGE_URL = defaultImage;
const PLATFORM_COMMISSION_RATE = 0.25;
const COURIER_SHARE_OF_COMMISSION = 0.5;

// ORDER PAGE - for logged in users after selecting a restaurant in UserPage/homeTab.jsx
export default function OrderPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { restaurantId } = useParams();
  const restaurant = location.state?.restaurant;
  const [quantities, setQuantities] = useState({});
  const [total, setTotal] = useState(0);
  const [customerTip, setCustomerTip] = useState(0);
  const [selectedTipPercentage, setSelectedTipPercentage] = useState(0);
  const [userId, setUserId] = useState(null);
  const [userData, setUserData] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [userDataLoaded, setUserDataLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedModifications, setSelectedModifications] = useState({});
  const [restaurantNote, setRestaurantNote] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  
  // useEffect: Authentication listener - users that are not logged in cannot access this page (redirected to Login page)
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

  // useEffect: Redirect to UserPage if invalid restaurant url
  useEffect(() => {
    if (!restaurant) {
      navigate("/user");
    }
  }, [restaurant, navigate]);

  // useEffect: Calculate total order price; and recalculate total when cartItems change
  useEffect(() => {
    if (!restaurant?.menu) return;
    let newTotal = cartItems.reduce((acc, item) => {
        const itemPrice = item.price;
        const modsPrice = item.selectedMods.reduce((modAcc, mod) => modAcc + mod.price, 0);
        return acc + (itemPrice + modsPrice) * item.quantity;
    }, 0);

    setTotal(newTotal);
  }, [cartItems, selectedTipPercentage, restaurant]);

  // useEffect: Recalculate tip when total changes
  useEffect(() => {
    handleTipPercentageChange(selectedTipPercentage);
  }, [total, selectedTipPercentage]);

  // FUNCTION: Sets item quantity and item modification quantity to a value in local state
  const handleQuantityChange = (index, value) => {
    const qty = parseInt(value, 10);
    if (isNaN(qty) || qty < 0) return;
    
    if (qty <= 0) {
        setQuantities((prev) => {
            const newQuantities = { ...prev };
            delete newQuantities[index];
            return newQuantities;
        });
        setSelectedModifications((prev) => {
            const newMods = { ...prev };
            delete newMods[index];
            return newMods;
        });
    } else {
        setQuantities((prev) => ({
            ...prev,
            [index]: qty,
        }));
    }
  };

  // FUNCTION: Sets item modification checkbox status to local state
  const handleModificationToggle = (itemIndex, modName, modPrice) => {
    setSelectedModifications(prev => {
        const mods = prev[itemIndex] || [];
        const isSelected = mods.some(mod => mod.name === modName);
        
        let newMods;
        if (isSelected) {
            newMods = mods.filter(mod => mod.name !== modName);
        } else {
            newMods = [...mods, { name: modName, price: modPrice }];
        }
        
        return {
            ...prev,
            [itemIndex]: newMods,
        };
    });
  };

  // FUNCTION: Handles adding an item to the cart
  const handleAddToCart = (index) => {
    const qty = quantities[index] || 0;
    const item = restaurant.menu[index];

    if (qty <= 0) {
        alert("Please select a quantity greater than zero.");
        return;
    }

    const newItem = {
        name: item.name,
        quantity: qty,
        price: item.price,
        prepTime: item.prepTime || 0,
        selectedMods: selectedModifications[index] || [],
    };

    setCartItems(prev => [...prev, newItem]);
    
    // Clear temporary selection states
    setQuantities(prev => {
        const newQuantities = { ...prev };
        delete newQuantities[index];
        return newQuantities;
    });
    setSelectedModifications(prev => {
        const newMods = { ...prev };
        delete newMods[index];
        return newMods;
    });
  };

  // FUNCTION: Removes an item from the cart
  const handleRemoveFromCart = (groupedItem) => {
      // 1. Create the unique key for the item to remove
      const sortedModNames = groupedItem.selectedMods
          .map(mod => mod.name)
          .sort()
          .join('|');
      const uniqueKeyToRemove = `${groupedItem.name}-${sortedModNames}`;
      
      // 2. Filter the raw cartItems array keeping non-matching item
      setCartItems(prev => prev.filter(item => {
          const currentSortedModNames = item.selectedMods
              .map(mod => mod.name)
              .sort()
              .join('|');
          const currentUniqueKey = `${item.name}-${currentSortedModNames}`;
          
          return currentUniqueKey !== uniqueKeyToRemove;
      }));
  };

  const groupCartItems = (rawCartItems) => {
    const groupedItemsMap = new Map();
    rawCartItems.forEach(item => {
        const sortedModNames = item.selectedMods
            .map(mod => mod.name)
            .sort()
            .join('|');
        const uniqueKey = `${item.name}-${sortedModNames}`;

        if (groupedItemsMap.has(uniqueKey)) {
            const existingItem = groupedItemsMap.get(uniqueKey);
            existingItem.quantity += item.quantity;
            existingItem.totalPrice += (item.quantity * (item.price + item.selectedMods.reduce((a, b) => a + b.price, 0)));
        } else {
            groupedItemsMap.set(uniqueKey, {
                ...item,
                unitPriceWithMods: item.price + item.selectedMods.reduce((a, b) => a + b.price, 0),
                totalPrice: (item.quantity * (item.price + item.selectedMods.reduce((a, b) => a + b.price, 0)))
            });
        }
    });
    return Array.from(groupedItemsMap.values());
  };
  const groupedCartItems = groupCartItems(cartItems);

  // FUNCTION: Updates the 0th element of the restaurantNote array
  const handleGlobalNoteChange = (e) => {
    const newNote = e.target.value;
    setRestaurantNote(prevNotes => {
        const newNotes = [...prevNotes];
        newNotes[0] = newNote;
        return newNotes;
    });
  };

  // FUNCTION: Updates the customerTip state directly
  const handleTipChange = (value) => {
    const tip = parseFloat(value);
    if (!isNaN(tip) && tip >= 0) {
      setCustomerTip(tip);
    } else if (value === "") {
      setCustomerTip(0);
    }
  };

  // FUNCTION: Calculates and sets the customer tip based on selected percentage
  const handleTipPercentageChange = (percentage) => {
    const rate = parseFloat(percentage);
    setSelectedTipPercentage(rate);

    if (rate > 0) {
      const calculatedTip = total * rate;
      handleTipChange(calculatedTip.toFixed(2));
    } else {
      handleTipChange(0);
    }
  };

  // FUNCTION: Submit button order validation, payment division, and order creation
  const handleSubmitOrder = async () => {
    //1. Submission validation
    if (isSubmitting) {
      console.log("Order submission already in progress. Ignoring duplicate click.");
      return;
    }
    setIsSubmitting(true);
    if (!isRestaurantOpenToday(restaurant.hours, new Date())) {
      alert("Store is currently closed. Please try during open hours.");
      setIsSubmitting(false);
      return;
    }
    if (!isRestaurantAcceptingOrders(restaurant.autoSetting)) {
      alert("Store is currently not accepting orders.");
      setIsSubmitting(false);
      return;
    }
    if (!userData?.deliveryLocation) {
      alert("Missing user location.");
      setIsSubmitting(false);
      return;
    }

    if (!userData?.address) {
      alert("Missing user address.");
      setIsSubmitting(false);
      return;
    }
    if (cartItems.length === 0) {
      alert("Please add at least one item to your cart before submitting.");
      setIsSubmitting(false);
      return;
    }

    //2. Payment division to platform, restaurant, and courier 
    const commissionAmount = total * PLATFORM_COMMISSION_RATE;
    const COURIER_BASE_PAY = commissionAmount * COURIER_SHARE_OF_COMMISSION;
    const paymentRestaurant = total - commissionAmount;
    const paymentCourier  = COURIER_BASE_PAY + customerTip;
    const paymentPlatform = commissionAmount - COURIER_BASE_PAY;

    //3. Create the order
    try {
      const restaurantRef = doc(db, "restaurants", restaurantId);
      const restaurantSnap = await getDoc(restaurantRef);

      if (!restaurantSnap.exists()) {
        alert("Restaurant not found.");
        setIsSubmitting(false);
        return;
      }

      const restaurantData = restaurantSnap.data();
      const currentTotalOrders = restaurantData.totalOrders || 0;
      const orderId = `${restaurantId}_${currentTotalOrders}`;

      // 3A: Set newOrder.items into Firestore database format: array/map
      const items = groupedCartItems.map(item => ({
        name: item.name,
        quantity: item.quantity,
        prepTime: item.prepTime || 0,
        selectedMods: item.selectedMods,
      }));

      // 3B: Calculate the newOrder.totalPrepTime value
      const totalPrepTime = items.reduce(
        (sum, item) => sum + (item.prepTime || 0) * item.quantity,
        0
      );
    
      // 3C: Set order.orderTimeout value for accept/rejection
      const createdAt = Timestamp.now();
      const orderTimeout = Timestamp.fromMillis(createdAt.toMillis() + 60000);

      // 3D: Set the newOrder fields with appropriate values
      const newOrder = {
        createdAt: createdAt,
        courierConfirmed: false,
        courierPickedUp: false,
        courierId: "",
        estimatedPreppedTime: null,
        deliveryStatus: "Awaiting restaurant confirmation.",
        items,
        orderCompleted: false,
        orderConfirmed: null, // need this null
        orderId,
        orderTimeout: orderTimeout,
        payment: total + customerTip,
        paymentCourier: paymentCourier ,
        paymentPlatform: paymentPlatform,
        paymentRestaurant: paymentRestaurant,
        restaurantId,
        restaurantAddress: restaurant.address || "",
        restaurantLocation: coordinateFormat(restaurant.location),
        restaurantNote: restaurantNote,
        storeName: restaurant.storeName,
        totalPrepTime,
        userAddress: userData.address,
        userId,
        userLocation: coordinateFormat(userData.deliveryLocation),
      };

      // 3E: Create a newOrder document in Firestore database collection restaurants/{restaurantId}/restaurantOrders
      const orderRef = doc(db, "restaurants", restaurantId, "restaurantOrders", orderId);
      await setDoc(orderRef, newOrder);

      await updateDoc(restaurantRef, {
        totalOrders: increment(1),
      });

      // 3F: Redirect to UserPage after to order
      navigate("/user", {
        state: {
          total: total + customerTip,
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

  // ERROR PREVENTION (PAGE)
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
                  onClick={() => navigate('/user?activeTab=settings')}
                  className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
              >
                  Go to Settings
              </button>
          </div>
      );
  }

  // USER INTERFACE
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
          
          {/* 1. MENU ITEMS */}
          <h2 className="text-xl font-bold mt-2 mb-4">Menu Items</h2>
          <ul className="space-y-4">
            {restaurant.menu.map((item, index) => {
              if (!item.available) return null;

              const currentQuantity = quantities[index] || 0;
              const hasModifications = item.modifications && item.modifications.length > 0;

              return (
                <li key={index} className="border rounded p-4 flex gap-4 items-start shadow-sm bg-white">
                  <img
                    src={item.imgUrl || DEFAULT_IMAGE_URL} 
                    alt={item.name}
                    style={{ width: "100px", height: "100px", objectFit: "cover" }}
                    className="rounded flex-shrink-0"
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

                    {/* OPTIONS SECTION */}
                    {hasModifications && (
                        <div className={`mt-2 p-3 border rounded-md ${currentQuantity > 0 ? 'bg-gray-50' : 'bg-gray-200'} transition-colors`}>
                            <h4 className="text-sm font-semibold mb-2 text-gray-700">Select Options:</h4>
                            <div className="space-y-1">
                                {item.modifications.map((mod, modIndex) => (
                                    <label key={modIndex} className={`flex items-center text-sm cursor-pointer ${currentQuantity === 0 ? 'text-gray-500' : 'text-gray-900'}`}>
                                        <input
                                            type="checkbox"
                                            className="mr-2"
                                            checked={selectedModifications[index]?.some(sMod => sMod.name === mod.name) || false}
                                            onChange={() => handleModificationToggle(index, mod.name, mod.price)}
                                            disabled={currentQuantity === 0}
                                        />
                                        {mod.name} 
                                        {mod.price > 0 && <span className="text-xs ml-1 font-medium text-gray-600"> (+${mod.price.toFixed(2)})</span>}
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* QUANTITY INPUT AND ADD TO CART BUTTON */}
                    <div className="flex items-center space-x-2 mt-2">
                        <input
                          type="number"
                          min="0"
                          className="w-20 border px-2 py-1 rounded"
                          value={quantities[index] || ""}
                          onChange={(e) => handleQuantityChange(index, e.target.value)}
                          placeholder="Qty"
                        />
                        <button
                            type="button"
                            onClick={() => handleAddToCart(index)}
                            disabled={currentQuantity === 0}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                                currentQuantity > 0 ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            Add to Cart
                        </button>
                  </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* 2. CART SUMMARY */}
          <div className="mt-8 p-4 border rounded-md bg-yellow-50 shadow-md">
              <h3 className="text-lg font-bold mb-3 flex items-center">
                  🛒 Your Cart ({cartItems.reduce((sum, item) => sum + item.quantity, 0)} items total)
              </h3>
              {groupedCartItems.length === 0 ? (
                  <p className="text-gray-600 italic">Your cart is empty. Add items from the menu above.</p>
              ) : (
                  <ul className="space-y-3">
                      {groupedCartItems.map((item, cartIndex) => (
                          <li key={item.name + item.selectedMods.map(m => m.name).join('')} className="text-sm border-b pb-2 flex justify-between items-start">
                              <div className='flex-1 pr-2'>
                                  <p className="font-semibold">{item.quantity}x {item.name}</p>
                                  {item.selectedMods.length > 0 && (
                                      <p className="text-xs text-gray-600 ml-2">
                                          Options: {item.selectedMods.map(mod => mod.name).join(', ')}
                                      </p>
                                  )}
                              </div>
                              <div className='flex-shrink-0 text-right'>
                                  <p className="font-medium">${item.totalPrice.toFixed(2)}</p>
                                  <button 
                                      type="button" 
                                      onClick={() => handleRemoveFromCart(item)}
                                      className="text-xs text-red-500 hover:text-red-700 mt-1"
                                  >
                                      Remove All
                                  </button>
                              </div>
                          </li>
                      ))}
                  </ul>
              )}
          </div>

          {/* 3. ORDER NOTES */}
          <div className="mt-4 p-4 border rounded-md bg-white shadow-md">
            <h3 className="text-lg font-semibold mb-3">Order Notes</h3>
            
            <div className="mb-4">
                <label htmlFor="restaurant-note" className="text-sm font-medium text-gray-700 block mb-1">Optional: Restaurant note (e.g., allergies, special prep):</label>
                <textarea
                    id="restaurant-note"
                    rows="2"
                    className="w-full border px-3 py-2 rounded text-sm resize-none"
                    placeholder="If filled, order acceptance at restaurant discretion."
                    value={restaurantNote[0] || ""}
                    onChange={handleGlobalNoteChange}          
                />
            </div>
          </div>
          
          {/* 4. PAYMENT */}
          <div className="mt-6 p-4 border rounded-md bg-white shadow-md">
            <h3 className="text-lg font-semibold mb-3">Payment Summary</h3>
            <div className="space-y-1">
                <div className="flex justify-between">
                    <span className="text-gray-700">Subtotal:</span>
                    <span className="font-medium">${total.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center py-2 border-t border-b">
                    <label htmlFor="tip-select" className="text-gray-700">Add Tip:</label>
                    <select
                        id="tip-select"
                        className="border px-2 py-1 rounded text-sm"
                        value={selectedTipPercentage}
                        onChange={(e) => handleTipPercentageChange(e.target.value)}
                    >
                        <option value={0}>No Tip</option>
                        <option value={0.10}>10% Tip</option>
                        <option value={0.15}>15% Tip</option>
                        <option value={0.20}>20% Tip</option>
                        <option value={0.25}>25% Tip</option>
                    </select>
                </div>

                <div className="flex justify-between">
                    <span className="text-gray-700">Courier Tip:</span>
                    <span className="font-medium">${customerTip.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between pt-2">
                    <p className="text-xl font-bold">Grand Total:</p>
                    <p className="text-xl font-bold text-green-700">${(total + customerTip).toFixed(2)}</p>
                </div>
            </div>
            
            <div className="mt-4 text-right">
              <button
                type="submit"
                className={`w-full bg-green-600 text-white px-4 py-3 rounded-md text-lg font-semibold transition-colors ${isSubmitting || cartItems.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-700'}`}
                disabled={isSubmitting || cartItems.length === 0}
              >
                {isSubmitting ? "Submitting..." : `Pay & Submit $${(total + customerTip).toFixed(2)}`}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}