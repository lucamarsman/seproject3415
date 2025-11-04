import React, { useState } from 'react';
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "../../firebase";

const REPLY_TIMEOUT_EXTENSION_MS = 300000; 

export default function OrdersTab({
  restaurantData,
  loadingOrders,
  unhandledOrders,
  confirmedOrders,
  handleConfirmOrder,
  handleRejectOrder,
}) {
  const pendingOrders = unhandledOrders.filter(
    (order) => order.orderConfirmed !== false
  );

  const [replyText, setReplyText] = useState({});

  // Helper function to check if the first note element is a non-empty string
  const hasCustomerNote = (order) => {
    return Array.isArray(order.restaurantNote) && order.restaurantNote.length > 0 &&  typeof order.restaurantNote[0] === 'string' && 
    order.restaurantNote[0].trim() !== "";
  };

  // 3. RESTAURANT MANAGER CLICKS REPLY: Update array and extend timeout
  const handleReply = async (orderId, replyContent) => {
      if (!replyContent.trim()) {
          alert("Please enter a reply before sending.");
          return;
      }
      const newTimeoutMillis = Date.now() + REPLY_TIMEOUT_EXTENSION_MS;
      const newOrderTimeout = Timestamp.fromMillis(newTimeoutMillis);
      
      // Look for the order in either array (pending or confirmed)
      const targetOrder = pendingOrders.find(o => o.orderId === orderId) || confirmedOrders.find(o => o.orderId === orderId);

      try {
          const orderRef = doc(db, "restaurants", restaurantData.id, "restaurantOrders", orderId);
          const managerNote = `Manager Reply (${new Date().toLocaleTimeString()}): ${replyContent.trim()}`;
          await updateDoc(orderRef, {
              orderTimeout: newOrderTimeout,
              // Use the target order's notes if found, otherwise an empty array
              restaurantNote: [...(targetOrder?.restaurantNote || []), managerNote]
          });
          console.log(`Successfully extended orderTimeout for order: ${orderId} to ${new Date(newTimeoutMillis).toLocaleString()}`);
          // Clear the local reply state after successful send
          setReplyText(prev => ({ ...prev, [orderId]: '' }));

      } catch (error) {
          console.error("Error sending reply or updating order timeout:", error);
          alert("Failed to send reply. Check console for details.");
      }
  };
  
  // Helper component to render item details and notes
  const OrderItemDetails = ({ order }) => (
    <>
      <strong className="block mb-1 text-base">Items:</strong>
      <ul className="ml-0 space-y-2 text-sm">
        {order.items?.map((item, i) => (
          <li key={i} className="py-1 px-2 border rounded bg-gray-50">
            <p className="font-medium text-base">
              {item.name} × <strong className="text-grey-600">{item.quantity}</strong> (Prep: {item.prepTime} min)
            </p>
            
            {/* Modifications/Options */}
            {(item.selectedMods && item.selectedMods.length > 0) && (
                <ul className="list-disc list-inside ml-4 text-xs text-gray-700 mt-1">
                    <span className="font-semibold text-gray-600">Options:</span>
                    {item.selectedMods.map((mod, modIdx) => (
                        <li key={modIdx} className="ml-1 inline-block mr-2">
                            {mod.name} 
                            {mod.price > 0 && <span className="font-mono ml-0.5 text-gray-500">(+${mod.price.toFixed(2)})</span>}
                        </li>
                    ))}
                </ul>
            )}
          </li>
        ))}
      </ul>
      
      {/* Display Global Order Notes */}
      {Array.isArray(order.restaurantNote) && order.restaurantNote.length > 0 && (
        <> 
          <strong className="block mb-1 mt-4 text-base border-t pt-2">Order Notes:</strong>
          <ul className="ml-0 space-y-2 text-sm">
            {order.restaurantNote.map((note, noteIdx) => {
                const noteContent = (note && typeof note === 'string' && note.trim() !== "") ? note.trim() : null;
                if (!noteContent) return null;

                let noteClass = 'bg-gray-100 border-gray-300 text-gray-800'; // Default
                let displayNote = noteContent;

                if (noteContent.startsWith("Manager Reply")) {
                    noteClass = 'bg-red-100 border-red-300 text-red-800'; 
                } else if (noteContent.startsWith("Customer Reply")) {
                    noteClass = 'bg-blue-100 border-blue-300 text-blue-800'; 
                } else if (noteIdx === 0 && order.orderConfirmed !== true) {
                    const timeString = new Date(order.createdAt?.toDate()).toLocaleTimeString();
                    displayNote = `Customer original message (${timeString}): ${noteContent}`;
                    noteClass = 'bg-blue-100 border-blue-300 text-blue-800'; // Blue like other customer messages
                }
                
                return (
                    <li 
                      key={noteIdx} 
                      className={`py-2 px-3 border rounded font-medium whitespace-pre-wrap ${noteClass}`}
                    >
                      {displayNote} 
                    </li>
                );
            })}
          </ul>
        </>
      )}
    </>
  );

  return (
    <>
      <h2 className="text-2xl font-semibold mb-4">
        Order Management ({pendingOrders.length} New, {confirmedOrders.length} Confirmed)
      </h2>
      <hr />

      {/* --- NEW ORDERS AWAITING CONFIRMATION --- */}
      <div className="mt-6">
        <h3 className="text-xl font-semibold mb-4 border-b pb-2 text-black-800">
          New Orders
        </h3>

        {loadingOrders ? (
          <p>Loading orders…</p>
        ) : pendingOrders.length === 0 ? (
          <p className="text-gray-500">
            No new orders awaiting confirmation.
          </p>
        ) : (
          <div className="space-y-4">
            {pendingOrders.map((order) => (
              <div
                key={order.orderId}
                className="border rounded p-4 bg-yellow-50 border-yellow-300 text-yellow-800 shadow-sm"
              >
                <p className="text-sm text-gray-600"><strong>Order ID:</strong> {order.orderId}</p>
                <p>
                  <strong>Status:</strong>{" "}
                  <span className="font-medium text-red-600">{order.deliveryStatus}</span>
                </p>
                <p className="mb-2">
                  <strong>Order Placed:</strong>{" "}
                  {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : "N/A"}
                </p>
                
                <OrderItemDetails order={order} />
                
                {/* Conditional Buttons: ONLY show for unhandled orders */}
                {order.orderConfirmed == null && (
                  <div className="mt-4 flex flex-col space-y-3">
                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleConfirmOrder(order.orderId)}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-medium transition-colors w-full"
                      >
                        ✅ Accept Order
                      </button>
                      <button
                        onClick={() => handleRejectOrder(order.orderId)}
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-medium transition-colors w-full"
                      >
                        ❌ Reject
                      </button>
                    </div>
                    
                    {/* Reply Area: Show if the first note element is not empty */}
                    {hasCustomerNote(order) && (
                        <div className="mt-2 pt-2 border-t border-gray-300">
                            <strong className="block mb-1 text-sm text-blue-700">Message to Customer:</strong>
                            <textarea
                                value={replyText[order.orderId] || ''}
                            onChange={(e) => setReplyText({ ...replyText, [order.orderId]: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                            rows="3"
                            placeholder="Enter a reply to the customer..."
                          />
                          {/* Conditional Reply Button */}
                          <button
                          onClick={() => handleReply(order.orderId, replyText[order.orderId])}
                          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium transition-colors w-full mt-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                          // Button is disabled if the reply text is empty or just whitespace
                          disabled={!replyText[order.orderId] || replyText[order.orderId].trim() === ''}
                        >
                          Send Reply
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- CONFIRMED ORDERS (IN PROGRESS) --- */}
      <div className="mt-10">
        <h3 className="text-xl font-semibold mb-4 border-b pb-2 text-black-800">
          Confirmed Orders
        </h3>

        {loadingOrders ? (
          <p>Loading confirmed orders…</p>
        ) : confirmedOrders.length === 0 ? (
          <p className="text-gray-500">
            No orders are currently confirmed and in progress.
          </p>
        ) : (
          <div className="space-y-4">
            {confirmedOrders.map((order) => (
              <div
                key={order.orderId}
                className="border-2 rounded p-4 bg-green-50 border-green-500 text-gray-800 shadow-md"
              >
                <p className="text-sm text-gray-600"><strong>Order ID:</strong> {order.orderId}</p>
                <p>
                  <strong>Status:</strong>{" "}
                  <span className="font-medium text-green-700">
                    {order.deliveryStatus}
                  </span>
               </p>
                <p className="mb-2">
                  <strong>Order Confirmed:</strong>{" "}
                  {order.updatedAt?.toDate
                    ? order.updatedAt.toDate().toLocaleString()
                    : "N/A"}
               </p>
                <OrderItemDetails order={order} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}