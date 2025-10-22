import React, { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";

import homeIcon from "../../assets/home.svg";
import messagesIcon from "../../assets/messages.svg";
import settingsIcon from "../../assets/settings.svg";
import ordersIcon from "../../assets/orders.svg";

// Removed static cuisineBtns array; gets icons and labels from the database: systemFiles/systemVariables/iconTypes

function NavButton({ active, onClick, iconSrc, children, ariaLabel }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      aria-label={ariaLabel}
      className={`flex items-center gap-2 text-left px-3 py-2 rounded-md cursor-pointer transition-all
            ${
              active
                ? "bg-gray-200 text-gray-800"
                : "hover:bg-gray-100 text-gray-800"
            }`}
    >
      <img
        src={iconSrc}
        className="w-5 h-5 object-contain"
        alt=""
        aria-hidden="true"
      />
      {children}
    </button>
  );
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  filters,
  toggleType,
  clearTypes,
}) {
  // variable for cuisine buttons
  const [cuisineBtns, setCuisineBtns] = useState([]);
  const [loadingCuisines, setLoadingCuisines] = useState(true);

  // fetches the cuisine data from firestore
  useEffect(() => {
    const fetchCuisineIcons = async () => {
      setLoadingCuisines(true);
      try {
        const docRef = doc(db, "systemFiles", "systemVariables");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data().typeIcons;
          if (Array.isArray(data)) {
            setCuisineBtns(data);
          } else {
            console.error("typeIcons field is not an array:", data);
            setCuisineBtns([]);
          }
        } else {
          console.warn("System variables document not found.");
          setCuisineBtns([]);
        }
      } catch (error) {
        console.error("Error fetching cuisine icons:", error);
        setCuisineBtns([]);
      } finally {
        setLoadingCuisines(false);
      }
    };
    fetchCuisineIcons();
  }, []);

  return (
    <aside
      className="w-64 bg-white border-r border-gray-300 p-4 sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-scroll"
      aria-label="User navigation and filters"
    >
      <div className="flex flex-col space-y-2">
        <NavButton
          active={activeTab === "home"}
          onClick={() => setActiveTab("home")}
          iconSrc={homeIcon}
          ariaLabel="Go to Home tab"
        >
          {" "}
          Home{" "}
        </NavButton>
        <NavButton
          active={activeTab === "messages"}
          onClick={() => setActiveTab("messages")}
          iconSrc={messagesIcon}
          ariaLabel="Go to Messages tab"
        >
          {" "}
          Messages{" "}
        </NavButton>
        <NavButton
          active={activeTab === "settings"}
          onClick={() => setActiveTab("settings")}
          iconSrc={settingsIcon}
          ariaLabel="Go to Settings tab"
        >
          {" "}
          Settings{" "}
        </NavButton>
        <NavButton
          active={activeTab === "orders"}
          onClick={() => setActiveTab("orders")}
          iconSrc={ordersIcon}
          ariaLabel="Go to Orders tab"
        >
          {" "}
          My Orders{" "}
        </NavButton>

        <hr className="my-1 border-gray-300" />
        <div className="mt-3">
          {loadingCuisines ? (
            <p className="text-sm text-gray-500">Loading filters...</p>
          ) : (
            <div className="flex flex-col items-center space-y-3">
              {cuisineBtns.map(({ icon, type }) => {
                const active = filters.types.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      toggleType(type);
                      setActiveTab("home");
                    }}
                    aria-pressed={active}
                    className={`flex items-center justify-start w-[200px] px-2 py-0 rounded-lg border font-medium text-base transition-all cursor-pointer
                                          ${
                                            active
                                              ? "bg-blue-600 text-white border-blue-600 shadow-md"
                                              : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50 hover:shadow"
                                          }`}
                  >
                    <span className="inline-flex items-center justify-center w-8 h-8 mr-3 text-2xl">
                      {icon}
                    </span>
                    <span>{type}</span>
                  </button>
                );
              })}
              {filters.types.length > 0 && (
                <button
                  onClick={clearTypes}
                  className="text-sm text-blue-700 hover:underline self-start ml-2"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
