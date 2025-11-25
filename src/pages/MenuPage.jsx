import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
    doc, 
    getDoc 
} from "firebase/firestore";
import { db } from "../firebase"; 
import MenuItemCard from "../components/MenuItemCard.jsx";

// RESTAURANT MENU VIEW PAGE - for non-logged in users
export default function MenuPage() {
    const { id: restaurantId } = useParams();
    const navigate = useNavigate();
    const [menuItems, setMenuItems] = useState([]);
    const [restaurantData, setRestaurantData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // useEffect: Fetch all menu items from the selected restaurantId from Firestore database
    useEffect(() => {
        if (!restaurantId) {
            setLoading(false);
            setError("Restaurant ID is missing.");
            return;
        }

        const fetchMenuAndDetails = async () => {
            setLoading(true);
            setError(null);
            try {
                const restaurantDocRef = doc(db, "restaurants", restaurantId);
                const restaurantSnapshot = await getDoc(restaurantDocRef); 
                
                if (restaurantSnapshot.exists()) {
                    const data = restaurantSnapshot.data();
                    
                    const menuArray = data.menu || []; 

                    const fetchedItems = menuArray.map((item, index) => ({ 
                        id: `menu-item-${index}`, 
                        ...item 
                    }));
                    
                    setMenuItems(fetchedItems);
                    setRestaurantData(data);
                } else {
                    console.warn("Restaurant document not found for ID:", restaurantId);
                    setError("Restaurant not found or ID is incorrect.");
                }

            } catch (err) {
                console.error("Error fetching restaurant data:", err);
                setError("Failed to load restaurant details or menu.");
            } finally {
                setLoading(false);
            }
        };

        fetchMenuAndDetails();
    }, [restaurantId]);

    // VARIABLE: Filters menuItems by attribute "available"
    const availableMenuItems = useMemo(() => {
        return menuItems.filter(item => item.available !== false); 
    }, [menuItems]);
    const restaurantName = restaurantData?.storeName || "Restaurant";

    // ERROR PREVENTION (PAGE)
    if (loading) {
        return <div className="p-8 font-sans"></div>;
    }
    if (error) {
        return <div className="p-8 text-red-600 font-medium">Error: {error}</div>;
    }

    // USER INTERFACE   
    return (
        <div className="p-8 font-sans bg-gray-50 min-h-screen">
            <div className="max-w-3xl mx-auto"> 
                <button 
                    className="mt-3 self-start bg-orange-500 text-white font-medium py-2 px-4 rounded-lg 
                             shadow-md hover:bg-orange-600 transition duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-50"
                    onClick={() => navigate(-1)}
                >
                    ← Back
                </button>
                <h2 className="text-3xl font-semibold text-gray-900 mb-6 text-center">🍽️ Menu for {restaurantName}</h2>                
                <div className="flex flex-col gap-5 mt-5">
                    {availableMenuItems.length > 0 ? (
                        availableMenuItems.map((item) => (
                            <MenuItemCard
                                key={item.id} 
                                item={item}
                            />
                        ))
                    ) : (
                        <p className="text-gray-500 italic">No available menu items for this restaurant.</p>
                    )}
                </div>
            </div>
        </div>
    );
}