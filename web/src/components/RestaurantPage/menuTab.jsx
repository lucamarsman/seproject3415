import React, { useState } from "react";

import defaultImage from "../../assets/defaultImgUrl.png";
const DEFAULT_IMAGE_URL = defaultImage;

const MenuTab = ({ restaurantData, setRestaurantData, db, doc, updateDoc }) => {
  const [newMenuItem, setNewMenuItem] = useState({
    name: "",
    description: "",
    calories: "",
    price: "",
    prepTime: "",
    imgUrl: "",
    available: true,
  });

  // Handler to add a new menu item
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newMenuItem.name || !newMenuItem.price || !newMenuItem.prepTime) {
      alert("Name, price, & prep time required");
      return;
    }

    const finalImgUrl = newMenuItem.imgUrl.trim();

    // Prepare the item for Firestore: parse number strings to actual numbers
    const item = {
    ...newMenuItem,
    imgUrl: finalImgUrl, 
    calories: newMenuItem.calories ? parseInt(newMenuItem.calories) : null,
    price: parseFloat(newMenuItem.price),
    prepTime: newMenuItem.prepTime ? parseInt(newMenuItem.prepTime) : null,
  };

    const updatedMenu = [...(restaurantData.menu || []), item];

    const docRef = doc(db, "restaurants", restaurantData.id);
    try {
      await updateDoc(docRef, { menu: updatedMenu });
      // Update local state with the new, correctly formatted menu
      setRestaurantData((prev) => ({
        ...prev,
        menu: updatedMenu,
      }));
      // Reset form
      setNewMenuItem({
        name: "",
        description: "",
        calories: "",
        price: "",
        prepTime: "",
        imgUrl: "",
        available: true,
      });
      alert("Menu item added");
    } catch (err) {
      console.error("Add menu item error:", err);
      alert("Failed to add menu item");
    }
  };

  // Handler to update a single property of an existing menu item locally
  const handleItemChange = (e, index, field) => {
    const { value, type, checked } = e.target;
    setRestaurantData((prev) => {
      const newMenu = [...(prev.menu || [])];
      // Use checked for checkbox, value for others
      const newValue = type === "checkbox" ? checked : value;
      newMenu[index] = { ...newMenu[index], [field]: newValue };
      return { ...prev, menu: newMenu };
    });
  };

  // Handler to persist changes to a menu item in Firestore
  const handleUpdateItem = (idx) => {
    const itemToUpdate = restaurantData.menu[idx];

    // Convert string values back to numbers for Firestore/state consistency before saving
    const formattedItem = {
      ...itemToUpdate,
      calories: itemToUpdate.calories ? parseInt(itemToUpdate.calories) : null,
      price: parseFloat(itemToUpdate.price),
      prepTime: itemToUpdate.prepTime ? parseInt(itemToUpdate.prepTime) : null,
    };

    // Create the updated menu array with the formatted item
    const updatedMenu = restaurantData.menu.map((mi, i) =>
      i === idx ? formattedItem : mi
    );

    const docRef = doc(db, "restaurants", restaurantData.id);
    updateDoc(docRef, { menu: updatedMenu })
      .then(() => {
        alert("Menu item updated successfully!");
        // Update the state with the correctly formatted numbers
        setRestaurantData((prev) => ({
          ...prev,
          menu: updatedMenu,
        }));
      })
      .catch((err) => {
        console.error("Update menu error:", err);
        alert("Failed updating menu");
      });
  };

  // Handler to delete a menu item
  const handleDeleteItem = (idx) => {
    const updatedMenu = restaurantData.menu.filter((_, i) => i !== idx);
    const docRef = doc(db, "restaurants", restaurantData.id);

    updateDoc(docRef, { menu: updatedMenu })
      .then(() => {
        alert("Deleted menu item");
        setRestaurantData((prev) => ({
          ...prev,
          menu: updatedMenu,
        }));
      })
      .catch((err) => {
        console.error("Delete menu error:", err);
        alert("Failed deleting menu item");
      });
  };

  return (
    <>
      <h2 className="text-2xl font-semibold mb-4">Menu Management</h2>

      {/* Add new menu item Form */}
      <form
        className="mt-6 space-y-4 bg-gray-50 p-4 rounded shadow max-w-2xl"
        onSubmit={handleAddItem}
      >
        <h3 className="text-xl font-semibold border-b pb-2">
          Add New Menu Item
        </h3>
        <input
          type="text"
          placeholder="Name"
          value={newMenuItem.name}
          onChange={(e) =>
                setNewMenuItem((prev) => ({ ...prev, name: e.target.value }))
              }
          className="w-full border px-3 py-2 rounded"
          required
        />
        <textarea
          placeholder="Description"
          value={newMenuItem.description}
          onChange={(e) =>
            setNewMenuItem((prev) => ({ ...prev, description: e.target.value,
            }))
          }
          className="w-full border px-3 py-2 rounded"
          rows="2"
        />
        <div className="grid grid-cols-2 gap-4">
          <input
            type="number"
            placeholder="Calories"
            value={newMenuItem.calories}
            onChange={(e) =>
              setNewMenuItem((prev) => ({ ...prev, calories: e.target.value,
              }))
            }
            className="border px-3 py-2 rounded"
          />
          <input
            type="number"
            placeholder="Price"
            step="0.01"
            value={newMenuItem.price}
            onChange={(e) =>
              setNewMenuItem((prev) => ({
                ...prev,
                price: e.target.value,
              }))
            }
            className="border px-3 py-2 rounded"
            required
          />
          <input
            type="number"
            placeholder="Prep Time (min)"
            value={newMenuItem.prepTime}
            onChange={(e) =>
              setNewMenuItem((prev) => ({
                ...prev,
                prepTime: e.target.value,
              }))
            }
            className="border px-3 py-2 rounded"
          />
          <input
            type="text"
            placeholder="Image URL"
            value={newMenuItem.imgUrl}
            onChange={(e) =>
              setNewMenuItem((prev) => ({ ...prev, imgUrl: e.target.value }))
            }
            className="border px-3 py-2 rounded"
          />
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={newMenuItem.available}
            onChange={(e) =>
              setNewMenuItem((prev) => ({
                ...prev,
                available: e.target.checked,
              }))
            }
          />
          <span className="font-medium text-gray-700">Available</span>
        </label>
        <button
          type="submit"
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 w-full font-medium"
        >
          Add Item to Menu
        </button>
      </form>

      {/* --- */}

      {/* Current Menu Display */}
      {restaurantData.menu && restaurantData.menu.length > 0 && (
        <div className="mt-10">
          <h3 className="text-xl font-semibold mb-4 border-b pb-2">
            Current Menu Items ({restaurantData.menu.length})
          </h3>
          <ul className="space-y-4">
            {restaurantData.menu.map((item, idx) => (
              <li
                key={idx}
                className="border rounded p-4 flex flex-col sm:flex-row sm:items-start gap-4 bg-white shadow-md hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start space-x-4 w-full">
                  <img
                    src={item.imgUrl && item.imgUrl.trim() !== "" ? item.imgUrl : DEFAULT_IMAGE_URL}
                    alt={item.name}
                    style={{
                      width: "100px",
                      height: "100px",
                      objectFit: "cover",
                    }}
                    className="rounded flex-shrink-0"
                  />
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleItemChange(e, idx, "name")}
                      className="font-semibold w-full border px-2 py-1 rounded"
                    />
                    <textarea
                      value={item.description}
                      onChange={(e) => handleItemChange(e, idx, "description")}
                      className="text-sm w-full border px-2 py-1 rounded"
                      rows="2"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={item.calories}
                        onChange={(e) => handleItemChange(e, idx, "calories")}
                        placeholder="Calories"
                        className="text-sm w-full border px-2 py-1 rounded"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={item.price}
                        onChange={(e) => handleItemChange(e, idx, "price")}
                        placeholder="Price"
                        className="text-sm w-full border px-2 py-1 rounded"
                      />
                      <input
                        type="number"
                        value={item.prepTime}
                        onChange={(e) => handleItemChange(e, idx, "prepTime")}
                        placeholder="Prep Time"
                        className="text-sm w-full border px-2 py-1 rounded"
                      />
                    </div>
                    <input
                      type="text"
                      value={item.imgUrl}
                      onChange={(e) => handleItemChange(e, idx, "imgUrl")}
                      placeholder="Image URL"
                      className="text-sm w-full border px-2 py-1 rounded"
                    />

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={item.available}
                        onChange={(e) => handleItemChange(e, idx, "available")}
                      />
                      <span className="font-medium text-gray-700">
                        Available
                      </span>
                    </label>

                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleUpdateItem(idx)}
                        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
                      >
                        Update
                      </button>
                      <button
                        onClick={() => handleDeleteItem(idx)}
                        className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
};

export default MenuTab;