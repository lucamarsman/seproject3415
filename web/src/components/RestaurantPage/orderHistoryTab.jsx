import React from "react";

export default function OrderHistoryTab({ loadingOrders, allOrders = [] }) {
  // Show only rejected or timed-out orders
  const rejectedOrders = allOrders.filter((order) => order.orderConfirmed === false);

  return (
    <>
      <h2 className="text-2xl font-semibold mb-4">
        Rejected or Timed-Out Orders ({rejectedOrders.length})
      </h2>

      <div className="mt-6">
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
                  {order.createdAt?.toDate
                    ? order.createdAt.toDate().toLocaleString()
                    : "N/A"}
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
