import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import "../BrowseRestaurants.css";
import { useNavigate, useSearchParams } from "react-router-dom"; // 🔥 ADDED useSearchParams

export default function BrowseRestaurants() {
  const navigate = useNavigate();
  // 🔥 Read the URL query parameters
  const [searchParams] = useSearchParams();
  const filterType = searchParams.get('type'); // Gets the value of ?type=...

  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Set the title based on whether a filter is active
  const pageTitle = filterType 
    ? `🍴 Restaurants: ${filterType}` 
    : "🍴 Browse All Restaurants";

  // Fetch restaurants from Firestore
  useEffect(() => {
    const fetchRestaurants = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const restaurantsRef = collection(db, "restaurants");
        let q = restaurantsRef;

        // 🔥 CONDITIONAL FILTERING: Apply 'where' clause if filterType exists
        if (filterType) {
          // Create a Firestore query to filter by the 'type' field
          q = query(restaurantsRef, where("type", "==", filterType));
        }
        
        const snap = await getDocs(q); // Execute the query (filtered or unfiltered)
        
        const fetchedRestaurants = snap.docs.map((d) => ({ 
          id: d.id, 
          ...d.data() 
        }));

        setRestaurants(fetchedRestaurants);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching restaurants:", err);
        setError("Failed to load restaurants. Please check your connection.");
        setLoading(false);
      }
    };
    
    // 🔥 Dependency array now includes filterType, so the fetch reruns when the type changes
    fetchRestaurants();
  }, [filterType]); 

  // 🧭 Navigation is correct for your routing setup: /browseRestaurants/:id/menu
  const handleCheckMenu = (id) => {
    navigate(`/browseRestaurants/${id}/menu`);
  };

  if (loading) {
    return <div className="restaurants-page">Loading restaurants...</div>;
  }

  if (error) {
    return <div className="restaurants-page error-message">Error: {error}</div>;
  }
  
  // Show a message if no restaurants are found, mentioning the filter if active
  if (restaurants.length === 0) {
    return (
      <div className="restaurants-page">
        No restaurants found {filterType ? `for type "${filterType}"` : ""}.
      </div>
    );
  }

  return (
    <div className="restaurants-page">
      <h2 className="restaurants-title">{pageTitle}</h2>
      <div className="restaurant-list">
        {restaurants.map((r) => (
          <div key={r.id} className="restaurant-card">
            {r.imageUrl && <img src={r.imageUrl} alt={r.storeName} className="restaurant-image" />}
            <div className="restaurant-info">
              <h3>{r.storeName}</h3>
              <p>{r.type || "General Cuisine"}</p>
              <p className="rating">⭐ {r.rating || "N/A"} / 5</p>
              <button
                className="order-btn"
                onClick={() => handleCheckMenu(r.id)} 
              >
                Check Menu
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}