import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

// HOME PAGE - Entry url for all users (links to Login.jsx and BrowseRestaurants.jsx)
export default function Home() {
    const navigate = useNavigate();
    const [restaurantTypes, setRestaurantTypes] = useState([]);
    const [iconMap, setIconMap] = useState({});
    const [loading, setLoading] = useState(true);

    // FUNCTION: handles navigation when the main button is clicked (no filter)
    const handleBrowse = () => {
        navigate("/browseRestaurants");
    };

    // FUNCTION: handles the click on a type card, navigating with a query parameter
    const handleTypeClick = (type) => {
        navigate(`/browseRestaurants?type=${encodeURIComponent(type)}`);
    };

    // useEffect: sets restaurant to icon type
    useEffect(() => {
        const fetchRequiredData = async () => {
            setLoading(true);
            try {
                const restaurantCollectionRef = collection(db, "restaurants"); // Fetch all restaurants for Firestore database
                const restaurantSnapshot = await getDocs(restaurantCollectionRef);
                const types = restaurantSnapshot.docs
                    .map((doc) => doc.data().type)
                    .filter((type) => type);
                const uniqueTypes = [...new Set(types)];
                
                const configRef = doc(db, "systemFiles", "systemVariables"); // Fetch the type-icon mapping from systemFiles
                const configSnap = await getDoc(configRef);
                let iconLookup = {};
                if (configSnap.exists() && Array.isArray(configSnap.data().typeIcons)) {
                    iconLookup = configSnap.data().typeIcons.reduce((acc, item) => {
                        if (item.type && item.icon) {
                            acc[item.type] = item.icon;
                        }
                        return acc;
                    }, {});
                }

                setRestaurantTypes(uniqueTypes); // update the local state with current restaurant.type and associated icon types
                setIconMap(iconLookup);
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchRequiredData();
    }, []);

    // FUNCTION to match icon to restaurant.type
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
                    <p></p>
                ) : restaurantTypes.length > 0 ? (
                    restaurantTypes.map((type, index) => (
                        <button 
                            key={index} 
                            className="restaurant-card"
                            onClick={() => handleTypeClick(type)} 
                        >
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