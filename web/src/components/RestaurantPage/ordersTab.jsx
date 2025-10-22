export default function OrdersTab({loadingOrders, unhandledOrders, confirmedOrders, handleConfirmOrder, handleRejectOrder,}) {
    return (
        <>
            <h2 className="text-2xl font-semibold mb-4">
                Order Management ({unhandledOrders.length} New)
            </h2>

            {/* NEW ORDERS AWAITING CONFIRMATION */}
            <div className="mt-10">
                <h3 className="text-xl font-semibold mb-4 border-b pb-2">New Orders Awaiting Confirmation</h3>
                
                {loadingOrders ? (
                    <p>Loading orders…</p>
                ) : unhandledOrders.length === 0 ? (
                    <p className="text-gray-500">No new orders awaiting confirmation.</p>
                ) : (
                    <div className="space-y-4">
                        {unhandledOrders.map((order) => (
                            <div
                                key={order.orderId}
                                className="border-2 border-red-300 rounded p-4 bg-white shadow-lg"
                            >
                                <p className="text-sm text-gray-600">
                                    <strong>Order ID:</strong> {order.orderId}
                                </p>
                                <p>
                                    <strong>Status:</strong> <span className="font-medium text-red-600">{order.deliveryStatus}</span>
                                </p>
                                <p className="mb-2">
                                    <strong>Order Placed:</strong>{" "}
                                    {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : 'N/A'}
                                </p>
                                
                                <h4 className="font-semibold mt-3">Items:</h4>
                                <ul className="ml-4 list-disc text-sm">
                                    {order.items?.map((item, i) => (
                                        <li key={i} className="py-0.5">
                                            {item.name} × **{item.quantity}** (Prep: {item.prepTime} min)
                                        </li>
                                    ))}
                                </ul>

                                {/* Conditional Buttons: ONLY show for unhandled orders (null or undefined) */}
                                {order.orderConfirmed == null && (
                                    <div className="mt-4 flex space-x-3">
                                        <button
                                            onClick={() => handleConfirmOrder(order.orderId)}
                                            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-medium transition-colors"
                                        >
                                            ✅ Accept Order
                                        </button>
                                        <button
                                            onClick={() => handleRejectOrder(order.orderId)}
                                            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-medium transition-colors"
                                        >
                                            ❌ Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <hr className="my-8 border-t-2 border-gray-300" />
            
            {/* ORDERS AWAITING COURIER PICKUP */}
            <div className="mt-10">
                <h3 className="text-xl font-semibold mb-4 border-b pb-2">Orders Awaiting Pickup</h3>
                
                {loadingOrders ? (
                    <p>Loading orders…</p>
                ) : confirmedOrders.length === 0 ? (
                    <p className="text-gray-500">No orders currently awaiting pickup.</p>
                ) : (
                    <div className="space-y-4">
                        {confirmedOrders.map((order) => (
                            <div
                                key={order.orderId}
                                className="border-2 border-green-500 rounded p-4 bg-green-50 shadow-md"
                            >
                                <p className="text-sm text-gray-600">
                                    <strong>Order ID:</strong> {order.orderId}
                                </p>
                                <p>
                                    <strong>Status:</strong> <span className="font-medium text-green-700">{order.deliveryStatus}</span>
                                </p>
                                <p>
                                    <strong>Courier ID:</strong> {order.courierId || 'Awaiting Courier'}
                                </p>
                                <p className="mb-2">
                                    <strong>Estimated Ready:</strong>{" "}
                                    {order.estimatedReadyTime?.toDate().toLocaleString()}
                                </p>
                                
                                <h4 className="font-semibold mt-3">Items:</h4>
                                <ul className="ml-4 list-disc text-sm">
                                    {order.items?.map((item, i) => (
                                        <li key={i} className="py-0.5">
                                            {item.name} × **{item.quantity}** (Prep: {item.prepTime} min)
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