import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getBannerUrl } from "../utils/getBannerUrl.js";
import { stringToColor } from "../utils/stringToColor.js";

// RESTAURANT VIEW PAGE FOR NON-LOGGED IN USERS
export default function BrowseRestaurants() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterType = searchParams.get('type'); 
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pageTitle = filterType ? `🍴 Restaurants: ${filterType}` : "🍴 Restaurants: All";

  // useEffect: Fetch all restaurants from Firestore database, filtered by cuisine type
  useEffect(() => {
    const fetchRestaurants = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const restaurantsRef = collection(db, "restaurants");
        const q = filterType 
          ? query(restaurantsRef, where("type", "==", filterType)) 
          : restaurantsRef;
        
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

  // ERROR PREVENTION (PAGE)
  if (loading) {
    return <div className="p-10 text-center text-lg text-gray-700">Loading restaurants...</div>;
  }
  if (error) {
    return <div className="p-10 text-center text-lg text-red-600 font-medium">Error: {error}</div>;
  }
  if (restaurants.length === 0) {
    return (
      <div className="p-10 text-center text-lg text-gray-500">
        No restaurants found {filterType ? `for type "${filterType}"` : ""}.
      </div>
    );
  }

  // USER INTERFACE
  return (
    <div className="p-6">
    <div className="hero"><h1>{pageTitle}</h1></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
        {restaurants.map((r) => (
          <div 
            key={r.id} 
            className="flex flex-col border border-gray-200 rounded-xl shadow-lg bg-white overflow-hidden 
                       hover:shadow-xl hover:-translate-y-1 transition duration-300 ease-in-out cursor-pointer"
          >
            <div className="relative w-full aspect-[5/1] bg-gray-100 overflow-hidden">
                {getBannerUrl(r) ? (
                  <img
                    src={getBannerUrl(r)}
                    alt={`${r.storeName} banner`}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(135deg, ${stringToColor(
                        r.storeName
                      )} 0%, #2563EB 100%)`,
                    }}
                  ></div>
                )}
            </div>
            <div className="p-5 flex gap-4 flex-grow items-start">
              {r.imageUrl && (
                <img 
                  src={r.imageUrl} 
                  alt={r.storeName} 
                  className="w-20 h-20 object-cover rounded-md flex-shrink-0 border border-gray-100" 
                />
              )}
              <div className="flex flex-col flex-grow">
                <h3 className="text-xl font-semibold text-gray-900 mb-1">{r.storeName}</h3>
                <p className="text-sm text-gray-600">{r.address}</p>
                <p className="text-sm text-gray-600 mb-2">{r.type || "General Cuisine"}</p>
                <p className="text-base font-medium text-yellow-500">⭐ {r.rating || "N/A"} / 5</p>
                <button 
                  className="mt-3 self-start bg-orange-500 text-white font-medium py-2 px-4 rounded-lg 
                             shadow-md hover:bg-orange-600 transition duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-50" 
                  onClick={() => handleCheckMenu(r.id)} 
                >
                  Check Menu
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}