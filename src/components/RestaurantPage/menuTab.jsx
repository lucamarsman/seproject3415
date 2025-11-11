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
    modifications: [],
  });

  const [newModName, setNewModName] = useState("");
  const [newModPrice, setNewModPrice] = useState("");
  const [editingMod, setEditingMod] = useState({});

  // --- Handlers for New Item Modifications ---
  const handleAddModification = () => {
    if (!newModName.trim()) {
      alert("Modification name is required.");
      return;
    }
    const priceValue = parseFloat(newModPrice || 0);
    if (isNaN(priceValue)) {
      alert("Invalid price value.");
      return;
    }

    const newMod = {
      name: newModName.trim(),
      price: priceValue,
    };

    setNewMenuItem((prev) => ({
      ...prev,
      modifications: [...prev.modifications, newMod],
    }));
    
    // Reset modification inputs
    setNewModName("");
    setNewModPrice("");
  };

  const handleRemoveModification = (modIndex) => {
    setNewMenuItem((prev) => ({
      ...prev,
      modifications: prev.modifications.filter((_, i) => i !== modIndex),
    }));
  };

  // --- Handlers for Existing Item Modifications ---
  const handleRemoveExistingModification = (itemIndex, modIndex) => {
    setRestaurantData((prev) => {
      const newMenu = [...(prev.menu || [])];
      const item = newMenu[itemIndex];
      item.modifications = (item.modifications || []).filter((_, i) => i !== modIndex);
      return { ...prev, menu: newMenu };
    });
  };

  const handleAddExistingModification = (itemIndex, modName, modPrice) => {
    if (!modName.trim()) {
      alert("Modification name is required.");
      return;
    }
    const priceValue = parseFloat(modPrice || 0);
    if (isNaN(priceValue)) {
      alert("Invalid price value.");
      return;
    }

    const newMod = {
      name: modName.trim(),
      price: priceValue,
    };

    setRestaurantData((prev) => {
      const newMenu = [...(prev.menu || [])];
      const item = newMenu[itemIndex];
      
      const currentMods = item.modifications || [];
      item.modifications = [...currentMods, newMod];
      return { ...prev, menu: newMenu };
    });
  };

  const handleEditingModChange = (itemIndex, field, value) => {
    setEditingMod(prev => ({
      ...prev,
      [itemIndex]: {
        ...prev[itemIndex],
        [field]: value
      }
    }));
  };

  const handleSaveEditingMod = (itemIndex) => {
    const modData = editingMod[itemIndex] || { name: '', price: '' };
    handleAddExistingModification(itemIndex, modData.name, modData.price); 
    setEditingMod(prev => ({ ...prev, [itemIndex]: { name: '', price: '' } }));
  };

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
      modifications: newMenuItem.modifications || [],
    };

    const updatedMenu = [...(restaurantData.menu || []), item];

    const docRef = doc(db, "restaurants", restaurantData.id);
    try {
      await updateDoc(docRef, { menu: updatedMenu });
      setRestaurantData((prev) => ({
        ...prev,
        menu: updatedMenu,
      }));
      setNewMenuItem({
        name: "",
        description: "",
        calories: "",
        price: "",
        prepTime: "",
        imgUrl: "",
        available: true,
        modifications: []
      });
      setNewModName("");
      setNewModPrice("");
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
      let newValue = type === "checkbox" ? checked : value;
      if (["price", "calories", "prepTime"].includes(field)) {
        newValue = value === "" ? "" : parseFloat(value);
      }
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
      modifications: itemToUpdate.modifications || [],
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
        
        {/* MODIFICATIONS MANAGEMENT SECTION (NEW ITEM) */}
        <div className="border border-gray-300 p-3 rounded space-y-3 bg-white">
            <h4 className="font-medium text-gray-700">Custom Checkbox Options (Modifications)</h4>
            
            {/* List Existing Modifications for New Item */}
            {newMenuItem.modifications.length > 0 && (
                <ul className="space-y-1 text-sm max-h-32 overflow-y-auto">
                    {newMenuItem.modifications.map((mod, i) => (
                        <li key={i} className="flex justify-between items-center bg-gray-50 p-2 border rounded">
                            <span>{mod.name} (${mod.price.toFixed(2)})</span>
                            <button
                                type="button"
                                onClick={() => handleRemoveModification(i)}
                                className="text-red-500 hover:text-red-700 text-lg ml-2"
                                title="Remove option"
                            >
                                &times;
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {/* Input for New Modification */}
            <div className="flex gap-2">
                <input
                    type="text"
                    placeholder="Option Name (e.g., Add Cheese)"
                    value={newModName}
                    onChange={(e) => setNewModName(e.target.value)}
                    className="flex-grow border px-3 py-2 rounded text-sm"
                />
                <input
                    type="number"
                    placeholder="Price"
                    min= "0"
                    step="0.01"
                    value={newModPrice}
                    onChange={(e) => setNewModPrice(e.target.value)}
                    className="w-20 border px-3 py-2 rounded text-sm"
                />
            </div>
            <button
                type="button"
                onClick={handleAddModification}
                className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm w-full"
            >
                + Add Option
            </button>
        </div>
        {/* END MODIFICATIONS SECTION */}

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
                    
                    {/* EDITABLE MODIFICATIONS DISPLAY AND DELETE (EXISTING ITEM) */}
                    {(item.modifications && item.modifications.length > 0) && (
                        <div className="mt-2 p-3 bg-gray-100 rounded">
                            <span className="text-xs font-bold text-gray-600 block mb-2">Options:</span>
                            <ul className="space-y-1 text-sm">
                                {item.modifications.map((mod, i) => (
                                    <li key={i} className="flex justify-between items-center bg-white p-2 rounded border border-gray-200">
                                        <span className="text-gray-700">{mod.name} (${mod.price.toFixed(2)})</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveExistingModification(idx, i)}
                                            className="text-red-500 hover:text-red-700 text-base ml-2 transition-colors"
                                            title="Remove option"
                                        >
                                            &times;
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    
                    {/* ADD NEW MODIFICATION TO EXISTING ITEM */}
                    <div className="mt-2 pt-3 border-t border-gray-200">
                        <span className="text-xs font-semibold text-gray-600 block mb-2">Add New Option:</span>
                        <div className="flex gap-2 items-center">
                            <input
                                type="text"
                                placeholder="Option Name"
                                value={editingMod[idx]?.name || ""}
                                onChange={(e) => handleEditingModChange(idx, 'name', e.target.value)}
                                className="flex-grow border px-2 py-1 rounded text-xs"
                            />
                            <input
                                type="number"
                                placeholder="Price"
                                step="0.01"
                                value={editingMod[idx]?.price || ""}
                                onChange={(e) => handleEditingModChange(idx, 'price', e.target.value)}
                                className="w-16 border px-2 py-1 rounded text-xs"
                            />
                            <button
                                type="button"
                                onClick={() => handleSaveEditingMod(idx)}
                                className="bg-blue-500 text-white text-xs px-2 py-1 rounded hover:bg-blue-600 flex-shrink-0"
                                disabled={!editingMod[idx]?.name} // Disable if name is empty
                            >
                                + Add
                            </button>
                        </div>
                    </div>
                    {/* END ADD NEW MODIFICATION */}

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