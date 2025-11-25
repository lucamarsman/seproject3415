import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
    doc, 
    getDoc 
} from "firebase/firestore";
import { db } from "../firebase"; 
import MenuItemCard from "../components/MenuItemCard.jsx";
import "./MenuPage.css";

// RESTAURANT MENU VIEW PAGE FOR NON-LOGGED IN USERS
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
        return <div className="menu-page">Loading menu...</div>;
    }
    if (error) {
        return <div className="menu-page error-message">Error: {error}</div>;
    }

    // USER INTERFACE   
    return (
        <div className="menu-page">
            <button className="back-btn" onClick={() => navigate(-1)}>
                ← Back
            </button>

            <h2>🍽️ Menu for {restaurantName}</h2>

            <div className="menu-list">
                {availableMenuItems.length > 0 ? (
                    availableMenuItems.map((item) => (
                        <MenuItemCard
                            key={item.id} 
                            item={item}
                        />
                    ))
                ) : (
                    <p>No available menu items for this restaurant.</p>
                )}
            </div>
        </div>
    );
}