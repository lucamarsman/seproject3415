import { useState, useEffect } from "react";
import { GeoPoint, doc, updateDoc } from "firebase/firestore";
import BannerManager from "./bannerUpload.jsx";

const phoneRegex = /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;

export default function InfoTab({
  restaurantData,
  setRestaurantData,
  cuisineTypes,
  loadingTypes,
  db,
  geocodeAddress,
  formatHoursForFirestore,
  parseHoursArray, // Passed from parent
}) {
  const [hoursState, setHoursState] = useState({});
  const [selectedType, setSelectedType] = useState("");

  // Populate hoursState and selectedType on initial load/data change
  useEffect(() => {
    if (!restaurantData) return;
    if (restaurantData.hours) {
      const parsed = parseHoursArray(restaurantData.hours);
      setHoursState(parsed);
    }
    if (restaurantData.type) {
      setSelectedType(restaurantData.type);
    } else if (cuisineTypes.length > 0) {
      setSelectedType(cuisineTypes[0]);
    }
  }, [restaurantData, cuisineTypes, parseHoursArray]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const storeName = form.storeName.value.trim();
    const address = form.address.value.trim();
    const phone = form.phone.value.trim();
    const type = selectedType;

    if (!phoneRegex.test(phone)) {
      alert(
        "Please enter a valid phone number (e.g. 123-456-7890)"
      );
      return;
    }

    try {
      const { lat, lng } = await geocodeAddress(address);
      const location = new GeoPoint(lat, lng);
      const formattedHours = formatHoursForFirestore(hoursState);

      const updated = {
        storeName,
        address,
        phone,
        type,
        location,
        hours: formattedHours,
      };

      const docRef = doc(db, "restaurants", restaurantData.id);
      await updateDoc(docRef, updated);

      setRestaurantData((prev) => ({ ...prev, ...updated }));
      alert("Restaurant info updated");
    } catch (err) {
      console.error("Update restaurant error:", err);
      alert("Failed to update restaurant info");
    }
  };

  return (
    <>
      <h2 className="text-2xl font-semibold mb-4">
        General Information
      </h2>

      <div className="space-y-6">
        <BannerManager restaurant={restaurantData} />
      </div>

      {/* Existing Restaurant Info Display */}
      <div className="mt-6 bg-gray-100 p-4 rounded shadow">
        <h3 className="text-xl font-semibold mb-2">Current Details</h3>
        <p>
          <strong>Restaurant ID:</strong> {restaurantData.restaurantId}
        </p>
        <p>
          <strong>Created At:</strong>{" "}
          {restaurantData.createdAt?.toDate
            ? restaurantData.createdAt.toDate().toLocaleString()
            : new Date(restaurantData.createdAt).toLocaleString()}
        </p>
        <p>
          <strong>Email:</strong> {restaurantData.email}
        </p>
        <p>
          <strong>Name:</strong> {restaurantData.name}
        </p>
        <p>
          <strong>Address / Location:</strong> {restaurantData.address} /
          Lat: {restaurantData.location?.latitude}, Lng:{" "}
          {restaurantData.location?.longitude}
        </p>
        <p>
          <strong>Total Orders:</strong> {restaurantData.totalOrders}
        </p>
        <p>
          <strong>Earnings:</strong> ${Number(restaurantData.earnings).toFixed(2)}
        </p>
        <p>
          <strong>Rating:</strong> {restaurantData.rating}
        </p>
      </div>

      {/* Form to edit restaurant info */}
      <form
        className="mt-6 space-y-4 max-w-md"
        onSubmit={handleSubmit}
      >
        <h3 className="text-xl font-semibold pt-4">
          Edit Restaurant Info
        </h3>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Store Name
          </label>
          <input
            name="storeName"
            defaultValue={restaurantData.storeName || ""}
            required
            className="w-full border px-2 py-1 rounded mt-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Address
          </label>
          <input
            name="address"
            defaultValue={restaurantData.address || ""}
            required
            className="w-full border px-2 py-1 rounded mt-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Phone
          </label>
          <input
            name="phone"
            defaultValue={restaurantData.phone || ""}
            required
            className="w-full border px-2 py-1 rounded mt-1"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Type
          </label>
          {loadingTypes ? (
            <p className="text-sm text-gray-500">
              Loading cuisine types...
            </p>
          ) : (
            <select
              name="type"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              required
              className="w-full border px-2 py-1 rounded bg-white mt-1"
              disabled={cuisineTypes.length === 0}
            >
              <option value="" disabled>
                Select a cuisine type
              </option>
              {cuisineTypes.map((typeOption) => (
                <option key={typeOption} value={typeOption}>
                  {typeOption}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="mt-4 p-4 bg-white rounded shadow-inner">
          <h3 className="font-semibold text-gray-800">
            Working Hours (HHMM format)
          </h3>
          {Object.entries(hoursState).map(
            ([day, { Opening, Closing }]) => (
              <div key={day} className="flex items-center gap-4 mb-2">
                <span className="w-20 font-medium text-sm">{day}</span>
                <input
                  type="text"
                  value={Opening}
                  onChange={(e) =>
                    setHoursState((prev) => ({
                      ...prev,
                      [day]: { ...prev[day], Opening: e.target.value },
                    }))
                  }
                  placeholder="0900"
                  className="border px-2 py-1 w-24 rounded text-sm"
                />
                <input
                  type="text"
                  value={Closing}
                  onChange={(e) =>
                    setHoursState((prev) => ({
                      ...prev,
                      [day]: { ...prev[day], Closing: e.target.value },
                    }))
                  }
                  placeholder="1700"
                  className="border px-2 py-1 w-24 rounded text-sm"
                />
              </div>
            )
          )}
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full font-medium"
        >
          Save Info
        </button>
      </form>
    </>
  );
}