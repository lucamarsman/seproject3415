import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
    doc, 
    getDoc 
} from "firebase/firestore";
import { db } from "../firebase"; // Assuming db is exported from here
import MenuItemCard from "../components/MenuItemCard.jsx";
import "../MenuPage.css";

export default function MenuPage() {
    // 'id' is the restaurantId from the route: /user/:name/:id/order
    const { id: restaurantId } = useParams();
    const navigate = useNavigate();

    // State for fetched data
    const [menuItems, setMenuItems] = useState([]);
    const [restaurantData, setRestaurantData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // State for cart
    const [cart, setCart] = useState([]);

    // --- Cart Handlers ---
    const addToCart = useCallback((item) => {
        setCart((prev) => [...prev, item]);
    }, []);

    // 🥘 Fetch restaurant details and menu items
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
                // --- 1. Fetch the main Restaurant Document (which contains the 'menu' array) ---
                const restaurantDocRef = doc(db, "restaurants", restaurantId);
                const restaurantSnapshot = await getDoc(restaurantDocRef); 
                
                if (restaurantSnapshot.exists()) {
                    const data = restaurantSnapshot.data();
                    
                    // --- CORRECTION: Extract the menu array from the document data ---
                    // The 'menu' field is an array of maps inside the restaurant document.
                    const menuArray = data.menu || []; 

                    // Map the array items and generate a unique client-side ID (since array items have no Firestore ID)
                    const fetchedItems = menuArray.map((item, index) => ({ 
                        id: `menu-item-${index}`, // Use index as a fallback unique key
                        ...item 
                    }));
                    
                    setMenuItems(fetchedItems);
                    setRestaurantData(data); // Set the rest of the restaurant data
                } else {
                    console.warn("Restaurant document not found for ID:", restaurantId);
                    setError("Restaurant not found or ID is incorrect.");
                }

            } catch (err) {
                console.error("Error fetching restaurant data:", err);
                // The error now specifically reflects the single operation
                setError("Failed to load restaurant details or menu.");
            } finally {
                setLoading(false);
            }
        };

        fetchMenuAndDetails();
    }, [restaurantId]);

    // Use useMemo to filter items efficiently, only recalculating when menuItems changes
    const availableMenuItems = useMemo(() => {
        // Filters items where 'available' is explicitly false
        return menuItems.filter(item => item.available !== false); 
    }, [menuItems]);

    // --- Render logic ---

    if (loading) {
        return <div className="menu-page">Loading menu...</div>;
    }

    if (error) {
        return <div className="menu-page error-message">Error: {error}</div>;
    }

    const restaurantName = restaurantData?.storeName || "Restaurant";
    
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
                            // item.id is now the generated ID: "menu-item-0", "menu-item-1", etc.
                            key={item.id} 
                            item={item}
                            onAddToCart={addToCart}
                        />
                    ))
                ) : (
                    <p>No available menu items for this restaurant.</p>
                )}
            </div>
        </div>
    );
}