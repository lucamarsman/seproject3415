import homeIcon from "../../assets/home.svg";
import menuIcon from "../../assets/menu.svg";
import settingsIcon from "../../assets/settings.svg";
import receiptIcon from "../../assets/receipt.svg";
import ordersIcon from "../../assets/orders.svg";

function NavButton({ active, onClick, iconSrc, children, ariaLabel, newOrderCount = 0 }) {
    const showBadge = newOrderCount > 0;
    
    const badgeSizeClasses = 
        newOrderCount < 10 
            ? 'w-5'
            : 'px-2';

    return (
        <button
            onClick={onClick}
            aria-current={active ? "page" : undefined}
            aria-label={ariaLabel}
            className={`flex items-center justify-between text-left px-3 py-2 rounded-md cursor-pointer transition-all
            ${
                active
                    ? "bg-blue-600 text-white"
                    : "hover:bg-gray-100 text-gray-800"
            }`}
        >
            <div className="flex items-center gap-2">
                <img
                    src={iconSrc}
                    className="w-5 h-5 object-contain"
                    alt=""
                    aria-hidden="true"
                />
                {children}
            </div>

            {showBadge && (
                <span 
                    className={`
                        // Badge styles
                        bg-red-600 text-white text-xs font-bold rounded-full 
                        
                        // Sizing and centering
                        h-5 flex items-center justify-center 
                        ${badgeSizeClasses} 
                        text-center
                        flex-shrink-0 // Crucial: Prevents the badge from shrinking when space is tight
                    `}
                    aria-label={`${newOrderCount} new orders pending`} 
                >
                    {newOrderCount > 99 ? '99+' : newOrderCount} 
                </span>
            )}
        </button>
    );
}

export default function Sidebar({
    activeTab,
    setActiveTab,
    newOrderCount, 
}) {
    return (
        <aside
            className="w-52 bg-gray-50 border-r border-gray-300 p-4 sticky top-16 h-screen" 
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
                    newOrderCount={newOrderCount} 
                > 
                    Orders 
                </NavButton>

                <NavButton 
                    active={activeTab === "orderHistory"} 
                    onClick={() => setActiveTab("orderHistory")} 
                    iconSrc={receiptIcon} 
                    ariaLabel="Order History"
                > 
                    Order History 
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