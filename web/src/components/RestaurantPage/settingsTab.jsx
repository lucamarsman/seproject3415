import { useState, useEffect } from "react";

export default function SettingsTab({ settings, onUpdateSettings }) {
  const [autoMode, setAutoMode] = useState(settings?.autoSetting ?? "manual");

  // Sync local state if settings change externally
  useEffect(() => {
    setAutoMode(settings?.autoSetting ?? "manual");
  }, [settings?.autoSetting]);

  const handleChange = (newMode) => {
    setAutoMode(newMode);
    onUpdateSettings?.({ autoSetting: newMode }); // match the key in RestaurantPage
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold mb-6 border-b pb-2">
        System Settings
      </h2>

      <div className="border rounded-lg p-6 bg-white shadow-sm">
        <h3 className="font-medium text-lg mb-2">Automatic Order Handling</h3>
        <p className="text-gray-600 text-sm mb-4">
          Choose how new orders are handled.
        </p>

        <div className="relative w-60 h-10 bg-gray-200 rounded-full flex items-center justify-between px-2">
          <div
            className={`absolute top-1 bottom-1 w-1/3 rounded-full transition-all duration-300 ${
              autoMode === "reject"
                ? "left-1 bg-red-500"
                : autoMode === "manual"
                ? "left-1/3 bg-gray-400"
                : "left-2/3 bg-green-500"
            }`}
          ></div>

          <button
            className={`relative z-10 w-1/3 text-center font-medium ${
              autoMode === "reject" ? "text-white" : "text-gray-700"
            }`}
            onClick={() => handleChange("reject")}
          >
            Reject
          </button>
          <button
            className={`relative z-10 w-1/3 text-center font-medium ${
              autoMode === "manual" ? "text-white" : "text-gray-700"
            }`}
            onClick={() => handleChange("manual")}
          >
            Manual
          </button>
          <button
            className={`relative z-10 w-1/3 text-center font-medium ${
              autoMode === "accept" ? "text-white" : "text-gray-700"
            }`}
            onClick={() => handleChange("accept")}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
