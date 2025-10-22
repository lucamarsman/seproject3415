import React from "react";
import "./MenuItemCard.css";

//returns Firestore Database items
export default function MenuItemCard({ item, onAddToCart }) {
  return (
    <div className={`menu-item-card ${item.popular ? "popular" : ""}`}>
      <img
        src={item.imgUrl} 
        alt={item.name}
        className="menu-item-image"
        onError={(e) =>
          (e.target.src =
            "https://via.placeholder.com/120x100.png?text=No+Image")
        }
      />
      <div className="menu-item-details">
        <h3>{item.name}</h3>
        {item.description && <p className="item-description">{item.description}</p>}
        {item.calories && <p className="item-calories">Calories: {item.calories}</p>}
        <p className="item-price">${item.price ? item.price.toFixed(2) : 'N/A'}</p>
        {item.popular && <span className="badge">⭐ Most Selling</span>}
      </div>
    </div>
  );
}