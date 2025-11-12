import React, { useEffect } from 'react';

const formatOrderTimestamp = (timestamp) => {
  return timestamp?.toDate ? timestamp.toDate().toLocaleString() : "N/A";
};

export default function OrderHistoryTab({ loadingOrders, allOrders = [], archiveOldOrders }) {
  const rejectedOrders = allOrders.filter((order) => order.orderConfirmed === false);
  const R_completedOrders = allOrders.filter((order) => order.courierPickedUp === true);
  const totalOrders = rejectedOrders.length + R_completedOrders.length;

  useEffect(() => {
    if (totalOrders > 5) {
      archiveOldOrders();
    }
  }, [totalOrders, archiveOldOrders]);

  return (
    <>
      <h2 className="text-2xl font-semibold mb-4">
        Order History ({totalOrders} Total)
      </h2>
      <p>Note: Orders are archived if the total is greater than 5, meet the completion criteria, and time length criteria.</p>
      {/* --- REJECTED/TIMED-OUT ORDERS --- */}
      <div className="mt-6">
        <h3 className="text-xl font-semibold mb-4 border-b pb-2 text-black-800">
          Recent Rejected / Timed-Out Orders ({rejectedOrders.length})
        </h3>
        {loadingOrders ? (
          <p>Loading orders…</p>
        ) : rejectedOrders.length === 0 ? (
          <p className="text-gray-500 italic">
            No rejected or timed-out orders found.
          </p>
        ) : (
          <div className="space-y-4">
            {rejectedOrders.map((order) => (
              <div
                key={order.orderId}
                className="border-2 border-red-300 rounded p-4 bg-white shadow-lg"
              >
                <p className="text-sm text-gray-600">
                  <strong>Order ID:</strong> {order.orderId}
                </p>
                <p>
                  <strong>Status:</strong>{" "}
                  <span className="font-medium text-red-600">
                    {order.deliveryStatus || "Rejected"}
                  </span>
                </p>
                <p className="mb-2">
                  <strong>Order Placed:</strong>{" "}
                  {formatOrderTimestamp(order.createdAt)}
                </p>

                <h4 className="font-semibold mt-3">Items:</h4>
                <ul className="ml-4 list-disc text-sm">
                  {order.items?.map((item, i) => (
                    <li key={i} className="py-0.5">
                      {item.name} × <strong>{item.quantity}</strong> (Prep:{" "}
                      {item.prepTime} min)
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- order != completed or confirmed "enroute orders" --- */}
      <div className="mt-10">
        <h3 className="text-xl font-semibold mb-4 border-b pb-2 text-black-800">
          Recent History ({R_completedOrders.length})
        </h3>
        {loadingOrders ? (
          <p>Loading orders…</p>
        ) : R_completedOrders.length === 0 ? (
          <p className="text-gray-500 italic">
            No orders have been picked up by the courier yet.
          </p>
        ) : (
          <div className="space-y-4">
            {R_completedOrders.map((order) => (
              <div
                key={order.orderId}
                className="border-2 border-green-300 rounded p-4 bg-white shadow-lg"
              >
                <p className="text-sm text-gray-600">
                  <strong>Order ID:</strong> {order.orderId}
                </p>
                <p>
                  <strong>Status:</strong>{" "}
                  <span className="font-medium text-green-600">
                    {order.deliveryStatus}
                  </span>
                </p>
                <p className="mb-2">
                  <strong>Order Placed:</strong>{" "}
                  {formatOrderTimestamp(order.createdAt)}
                </p>
                <p className="mb-2">
                  <strong>Courier ID:</strong> {order.courierId || "N/A"}
                </p>

                <h4 className="font-semibold mt-3">Items:</h4>
                <ul className="ml-4 list-disc text-sm">
                  {order.items?.map((item, i) => (
                    <li key={i} className="py-0.5">
                      {item.name} × <strong>{item.quantity}</strong> (Prep:{" "}
                      {item.prepTime} min)
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}