import homeIcon from "../../assets/home.svg";
import messagesIcon from "../../assets/messages.svg";
import menuIcon from "../../assets/menu.svg";
import settingsIcon from "../../assets/settings.svg";
import ordersIcon from "../../assets/orders.svg";

function NavButton({ active, onClick, iconSrc, children, ariaLabel }) {
    return (
        <button
            onClick={onClick}
            aria-current={active ? "page" : undefined}
            aria-label={ariaLabel}
            className={`flex items-center gap-2 text-left px-3 py-2 rounded-md cursor-pointer transition-all
            ${
                active
                    ? "bg-blue-600 text-white"
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
}) {
    return (
        <aside
            className="w-52 bg-gray-50 border-r border-gray-300 p-4 sticky top-0 h-screen" 
            aria-label="Restaurant Manager Navigation"
        >
            <h3 className="text-sm font-semibold uppercase text-gray-500 mb-3 ml-2">Navigation</h3>
            <div className="flex flex-col space-y-2">
                
                <NavButton 
                    active={activeTab === "info"} 
                    onClick={() => setActiveTab("info")} 
                    iconSrc={homeIcon} 
                    ariaLabel="Restaurant Information and Settings"
                > 
                    Restaurant Info 
                </NavButton>

                <NavButton 
                    active={activeTab === "menu"} 
                    onClick={() => setActiveTab("menu")} 
                    iconSrc={menuIcon}
                    ariaLabel="Manage Restaurant Menu Items"
                > 
                    Menu 
                </NavButton>

                <NavButton 
                    active={activeTab === "orders"} 
                    onClick={() => setActiveTab("orders")} 
                    iconSrc={ordersIcon} 
                    ariaLabel="View and Manage Orders"
                > 
                    Orders 
                </NavButton>
                
                <NavButton 
                    active={activeTab === "settings"} 
                    onClick={() => setActiveTab("settings")} 
                    iconSrc={settingsIcon} 
                    ariaLabel="General Settings"
                > 
                    Settings 
                </NavButton>
            </div>
        </aside>
    );
}