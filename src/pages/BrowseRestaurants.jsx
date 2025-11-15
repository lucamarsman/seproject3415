import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import "./BrowseRestaurants.css";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function BrowseRestaurants() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterType = searchParams.get('type'); 

  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const pageTitle = filterType 
    ? `🍴 Restaurants: ${filterType}` 
    : "🍴 Browse All Restaurants";

  // fetch restaurants from database
  useEffect(() => {
    const fetchRestaurants = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const restaurantsRef = collection(db, "restaurants");
        let q = restaurantsRef;
        if (filterType) {
          q = query(restaurantsRef, where("type", "==", filterType));
        }
        
        const snap = await getDocs(q);
        
        let fetchedRestaurants = snap.docs.map((d) => ({ 
          id: d.id, 
          ...d.data() 
        }));

        fetchedRestaurants.sort((a, b) => {
          const nameA = a.storeName ? a.storeName.toUpperCase() : '';
          const nameB = b.storeName ? b.storeName.toUpperCase() : '';
          
          if (nameA < nameB) return -1;
          if (nameA > nameB) return 1;
          return 0;
        });

        setRestaurants(fetchedRestaurants);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching restaurants:", err);
        setError("Failed to load restaurants. Please check your connection.");
        setLoading(false);
      }
    };
    
    fetchRestaurants();
  }, [filterType]);

  const handleCheckMenu = (id) => {
    navigate(`/browseRestaurants/${id}/menu`);
  };

  if (loading) {
    return <div className="restaurants-page">Loading restaurants...</div>;
  }

  if (error) {
    return <div className="restaurants-page error-message">Error: {error}</div>;
  }
  
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
              <p>{r.address}</p>
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