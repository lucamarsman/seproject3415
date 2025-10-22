import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function Home() {
    const navigate = useNavigate();
    const [restaurantTypes, setRestaurantTypes] = useState([]);
    const [iconMap, setIconMap] = useState({});
    const [loading, setLoading] = useState(true);

    // Function to handle the navigation when the main button is clicked (no filter)
    const handleBrowse = () => {
        navigate("/browseRestaurants");
    };

    // Function to handle the click on a type card, navigating with a query parameter
    const handleTypeClick = (type) => {
        navigate(`/browseRestaurants?type=${encodeURIComponent(type)}`);
    };

    // 🔥 MODIFIED useEffect to fetch both restaurant types and the icon lookup table
    useEffect(() => {
        const fetchRequiredData = async () => {
            setLoading(true);
            try {
                // 1. Fetch the unique restaurant types
                const restaurantCollectionRef = collection(db, "restaurants");
                const restaurantSnapshot = await getDocs(restaurantCollectionRef);

                const types = restaurantSnapshot.docs
                    .map((doc) => doc.data().type)
                    .filter((type) => type);

                const uniqueTypes = [...new Set(types)];
                
                // 2. Fetch the type-icon mapping from systemFiles
                const configRef = doc(db, "systemFiles", "systemVariables");
                const configSnap = await getDoc(configRef);

                let iconLookup = {};
                if (configSnap.exists() && Array.isArray(configSnap.data().typeIcons)) {
                    // Convert the array of maps [{type:'Pizza', icon:'🍕'}, ...]
                    // into a simple object map { 'Pizza': '🍕', ... } for quick lookup
                    iconLookup = configSnap.data().typeIcons.reduce((acc, item) => {
                        // Assuming the item structure is { type: "...", icon: "..." }
                        if (item.type && item.icon) {
                            acc[item.type] = item.icon;
                        }
                        return acc;
                    }, {});
                }

                // Update states
                setRestaurantTypes(uniqueTypes);
                setIconMap(iconLookup);

            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRequiredData();
    }, []);

    // Helper function to get the icon (defaults to a generic emoji)
    const getIconForType = (type) => {
        return iconMap[type] || "🍽️"; // Default icon if no match is found
    };

    return (
        <div className="p-6">
            <div className="hero">
                <h1>🍔 Fresh Food, Fast Delivery</h1>
                <p>Order from your favorite local restaurants with just a few clicks.</p>
                <button className="primary-btn" onClick={handleBrowse}>
                    Browse All Restaurants
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
                            onClick={() => handleTypeClick(type)} 
                        >
                            {/* 🔥 Display the icon next to the type name */}
                            <span className="type-icon">{getIconForType(type)}</span>
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