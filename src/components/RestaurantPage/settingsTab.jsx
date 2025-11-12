import { useState, useEffect } from "react";

export default function SettingsTab({ settings, onUpdateSettings }) {
  const [autoMode, setAutoMode] = useState(settings?.autoSetting ?? "manual");
  const [serviceRangeInput, setServiceRangeInput] = useState(
    settings?.serviceRange ?? 50
  );

  useEffect(() => {
    setAutoMode(settings?.autoSetting ?? "manual");
    setServiceRangeInput(settings?.serviceRange ?? 50);
  }, [settings?.autoSetting, settings?.serviceRange]);

  // AUTOSETTING TOGGLE
  const handleAutoChange = (newMode) => {
    setAutoMode(newMode);
    onUpdateSettings?.({ autoSetting: newMode });
  };

  // SERVICE RANGE ENTRY
  const handleServiceRangeSubmit = (e) => {
    e.preventDefault();
    const rangeValue = parseInt(serviceRangeInput, 10);
    if (isNaN(rangeValue) || rangeValue <= 0) {
      alert("Please enter a valid range (a number greater than 0).");
      return;
    }
    onUpdateSettings?.({ serviceRange: rangeValue });
  };

  return (
    <div className="mt-10">
      <h2 className="text-2xl font-semibold mb-6 border-b pb-2">
        System Settings
      </h2>

      {/* Automatic Order Handling Section */}
      <div className="border rounded-lg p-6 bg-white shadow-sm mb-8">
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
            onClick={() => handleAutoChange("reject")}
          >
            Reject
          </button>
          <button
            className={`relative z-10 w-1/3 text-center font-medium ${
              autoMode === "manual" ? "text-white" : "text-gray-700"
            }`}
            onClick={() => handleAutoChange("manual")}
          >
            Manual
          </button>
          <button
            className={`relative z-10 w-1/3 text-center font-medium ${
              autoMode === "accept" ? "text-white" : "text-gray-700"
            }`}
            onClick={() => handleAutoChange("accept")}
          >
            Accept
          </button>
        </div>
      </div>

      {/* Service Range Section */}
      <div className="border rounded-lg p-6 bg-white shadow-sm">
        <h3 className="font-medium text-lg mb-2">Service Range</h3>
        <p className="text-gray-600 text-sm mb-4">
          Set the maximum distance in kilometres your restaurant will serve customers.
        </p>

        <form onSubmit={handleServiceRangeSubmit} className="flex gap-4 items-end">
          <div className="flex flex-col">
            <label htmlFor="serviceRange" className="text-sm font-medium mb-1">
              New Range
            </label>
            <input
              id="serviceRange"
              type="number"
              min="1"
              value={serviceRangeInput}
              onChange={(e) => setServiceRangeInput(e.target.value)}
              className="border rounded-md p-2 w-32 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700 transition duration-150"
          >
            Update Range
          </button>
        </form>
      </div>
    </div>
  );
}