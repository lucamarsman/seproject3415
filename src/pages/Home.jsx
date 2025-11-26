import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

// HOME VIEW PAGE - Entry url for all users (links to Login.jsx and BrowseRestaurants.jsx)

// IMPORT LOGO
import logo from "../assets/logo-no-bg.png";

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
        <div className="p-6 space-y-10">

            <div className="w-full flex justify-center mt-4">
                <img 
                    src={logo} 
                    alt="Grab N Go Logo" 
                    className="w-64 md:w-96"
                />
            </div>

            <div className="hero text-center">
                <h1 className="text-4xl font-bold">🍔 Fresh Food, Fast Delivery</h1>
                <p className="text-gray-600 mt-2">Order from your favorite local restaurants with just a few clicks.</p>
                <button className="primary-btn mt-4" onClick={handleBrowse}>
                    Browse All Restaurants
                </button>
            </div>

            <div className="sample-restaurants flex flex-wrap gap-3 justify-center items-center">
                {loading ? (
                    <p>Loading restaurant categories...</p>
                ) : restaurantTypes.length > 0 ? (
                    restaurantTypes.map((type, index) => (
                        <button 
                            key={index} 
                            className="restaurant-card flex items-center gap-2 px-4 py-2 border rounded-xl shadow"
                            onClick={() => handleTypeClick(type)} 
                        >
                            <span className="type-icon text-2xl">{getIconForType(type)}</span>
                            {type}
                        </button>
                    ))
                ) : (
                    <p>No restaurant categories available.</p>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mt-10">
                <div className="cursor-pointer">
                    <img 
                        src="https://images.unsplash.com/photo-1556911220-bff31c812dba?q=80&w=1200" 
                        alt="Customer" 
                        className="w-full h-52 object-cover rounded-xl"
                    />
                    <h2 className="text-xl font-bold pt-6 text-center">Become a Customer</h2>
                    <div className="flex justify-center mt-4">
                        <a href="/become-a-customer" className="primary-btn">Order Now</a>
                    </div>
                </div>

                <div className="cursor-pointer">
                    <img 
                        src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1200" 
                        alt="Restaurant" 
                        className="w-full h-52 object-cover rounded-xl"
                    />
                    <h2 className="text-xl font-bold pt-6 text-center">Join Us Now</h2>
                    <div className="flex justify-center mt-4">
                        <a href="/become-a-restaurant" className="primary-btn">Add Your Restaurant</a>
                    </div>
                </div>

                <div className="cursor-pointer">
                    <img 
                        src="https://images.unsplash.com/photo-1524253482453-3fed8d2fe12b?q=80&w=1200" 
                        alt="Courier" 
                        className="w-full h-52 object-cover rounded-xl"
                    />
                    <h2 className="text-xl font-bold pt-6 text-center">Become a Courier</h2>
                    <div className="flex justify-center mt-4">
                        <a href="/become-a-courier" className="primary-btn">Sign up to Deliver</a>
                    </div>
                </div>
            </div>
        </div>
    );
}
