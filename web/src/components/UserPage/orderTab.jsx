export default function OrdersTab({ userOrders = [] }) {
  const visible = userOrders.filter((o) => o.orderConfirmed !== false);

  if (visible.length === 0) {
    return <p className="text-gray-600 italic">No current orders found.</p>;
  }

  return (
    <div className="space-y-4">
      {visible.map((order, index) => {
        const containerClassName = order.orderConfirmed === true
          ? "border-2 border-green-500 rounded p-4 bg-green-50 shadow-md"
          : "border rounded p-4 bg-yellow-50 border-yellow-300 text-yellow-800 shadow-sm";

        return (
          <div
            key={order.orderId || index}
            className={containerClassName} // Apply the conditional class
          >
            <h3 className="font-semibold text-lg mb-1">Order #{index + 1}</h3>
            <p>
              <strong>Status:</strong> {order.deliveryStatus}
            </p>
            <p>
              <strong>Restaurant:</strong> {order.fromRestaurant || "Restaurant"}{" "}
              <span className="text-gray-600">— {order.restaurantAddress}</span>
            </p>
            <p>
              <strong>Total:</strong> ${Number(order.payment ?? 0).toFixed(2)}
            </p>
            <p>
              <strong>Order Date:</strong>{" "}
              {order.createdAt?.toDate().toLocaleString()}
            </p>
            
            <div className="mt-4 pt-2 border-t border-gray-200">
              <strong className="block mb-1 text-base">Items:</strong>
              <ul className="space-y-3">
                {order.items?.map((item, idx) => (
                  <li key={idx} className="text-sm bg-white p-2 rounded border border-gray-100">
                    <p className="font-medium">
                      {item.name} (<span className="text-blue-600">x{item.quantity}</span>)
                    </p>
                    
                    {(item.selectedMods && item.selectedMods.length > 0) && (
                        <ul className="list-disc list-inside ml-4 text-xs text-gray-700 mt-1">
                            {item.selectedMods.map((mod, modIdx) => (
                                <li key={modIdx}>
                                    {mod.name} 
                                    {mod.price > 0 && <span className="font-mono ml-1 text-gray-500">(+${mod.price.toFixed(2)})</span>}
                                </li>
                            ))}
                        </ul>
                    )}
                    
                    {(item.requirements && item.requirements.trim() !== "") && (
                        <p className="mt-1 text-xs text-red-600">
                            **Item Note:** {item.requirements}
                        </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            
            {(order.restaurantNote || order.courierNote) && (
                <div className="mt-4 pt-2 border-t border-gray-200 text-sm">
                    <strong className="block mb-1 text-base">Order Notes:</strong>
                    
                    {order.restaurantNote && (
                        <p className="text-gray-800 bg-red-100 p-2 rounded mb-1">
                            **For Restaurant:** {order.restaurantNote}
                        </p>
                    )}
                    
                    {order.courierNote && (
                        <p className="text-gray-800 bg-blue-100 p-2 rounded">
                            **For Courier:** {order.courierNote}
                        </p>
                    )}
                </div>
            )}
          </div>
        );
      })}
    </div>
  );
}