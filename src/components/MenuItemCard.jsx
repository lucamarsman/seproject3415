import React from "react";
import "./MenuItemCard.css";

import defaultImage from "../assets/defaultImgUrl.png";
const DEFAULT_IMAGE_URL = defaultImage;

// returns Firestore Database items
export default function MenuItemCard({ item, onAddToCart }) {
  return (
    <div className={`menu-item-card ${item.popular ? "popular" : ""}`}>
      <img
        src={item.imgUrl || DEFAULT_IMAGE_URL} 
        alt={item.name}
        className="menu-item-image"
        onError={(e) => {
          if (e.currentTarget.src !== DEFAULT_IMAGE_URL) {
            e.currentTarget.src = DEFAULT_IMAGE_URL;
          }
        }}
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