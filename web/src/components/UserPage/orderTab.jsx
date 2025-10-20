export default function OrdersTab({ userOrders = [] }) {
  const visible = userOrders.filter((o) => o.orderConfirmed !== false);

  if (visible.length === 0) {
    return <p className="text-gray-600 italic">No current orders found.</p>;
  }

  return (
    <div className="space-y-4">
      {visible.map((order, index) => (
        <div
          key={order.orderId || index}
          className="border rounded p-4 bg-yellow-50 border-yellow-300 text-yellow-800 shadow-sm"
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
          <div className="mt-2">
            <strong>Items:</strong>
            <ul className="list-disc list-inside ml-4">
              {order.items?.map((item, idx) => (
                <li key={idx}>
                  {item.name} (x{item.quantity})
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}
