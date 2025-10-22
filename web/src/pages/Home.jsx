// Home.jsx (Refactored)

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function Home() {
  const navigate = useNavigate();
  const [restaurantTypes, setRestaurantTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Function to handle the navigation when the main button is clicked (no filter)
  const handleBrowse = () => {
    navigate("/browseRestaurants");
  };

  // 🔥 MODIFIED: Function to handle the click on a type card, navigating with a query parameter
  const handleTypeClick = (type) => {
    // Navigates to /browseRestaurants?type=Sushi
    navigate(`/browseRestaurants?type=${encodeURIComponent(type)}`);
  };

  useEffect(() => {
    // ... (fetchRestaurantTypes logic remains the same)
    const fetchRestaurantTypes = async () => {
      try {
        setLoading(true);
        const restaurantCollectionRef = collection(db, "restaurants");
        const snapshot = await getDocs(restaurantCollectionRef);
        
        const types = snapshot.docs
          .map((doc) => doc.data().type)
          .filter((type) => type); 

        const uniqueTypes = [...new Set(types)];
        
        setRestaurantTypes(uniqueTypes);
      } catch (error) {
        console.error("Error fetching restaurant types:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurantTypes();
  }, []);

  return (
    <div className="p-6">
      <div className="hero">
        <h1>🍔 Fresh Food, Fast Delivery</h1>
        <p>Order from your favorite local restaurants with just a few clicks.</p>
        <button className="primary-btn" onClick={handleBrowse}>
          Browse Restaurants (All)
        </button>
      </div>

      <div className="sample-restaurants">
        {loading ? (
          <p>Loading restaurant categories...</p>
        ) : restaurantTypes.length > 0 ? (
          restaurantTypes.map((type, index) => (
            <button 
              key={index} 
              className="restaurant-card"
              // 🔥 PASS THE TYPE TO THE CLICK HANDLER
              onClick={() => handleTypeClick(type)} 
            >
              {type}
            </button>
          ))
        ) : (
          <p>No restaurant categories available.</p>
        )}
      </div>
    </div>
  );
}