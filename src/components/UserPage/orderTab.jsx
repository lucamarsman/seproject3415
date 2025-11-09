import React, { useState } from 'react';
// Define the REPLY_TIMEOUT_EXTENSION_MS as provided
const REPLY_TIMEOUT_EXTENSION_MS = 300000; 

export default function OrdersTab({ 
    userOrders = [], 
    handleUserReply, 
    userId,
    userName,
    Timestamp,
    handleConfirmDelivery
}) {
    const [replyText, setReplyText] = useState({});
    const [isSaving, setIsSaving] = useState({});
    
    // --- FORMATTING FUNCTIONS ---
    const formatEstimatedTime = (date) => {
        if (date instanceof Date && !isNaN(date)) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return "TBD";
    };

    const handleConfirmation = async (orderId) => {
        console.log(`User confirming delivery for order: ${orderId}`);
        if (handleConfirmDelivery) {
            await handleConfirmDelivery(orderId);
        }
    }

    // 2. Local Reply Handler (Logic remains the same)
    const handleLocalReply = async (orderId, currentNotes, replyContent) => {
        const trimmedReply = replyContent.trim();
        if (!trimmedReply) {
            alert("Please enter a message before sending.");
            return;
        }

        setIsSaving(prev => ({ ...prev, [orderId]: true }));
        
        const newTimeoutMillis = Date.now() + REPLY_TIMEOUT_EXTENSION_MS;
        const newOrderTimeout = Timestamp 
            ? Timestamp.fromDate(new Date(newTimeoutMillis)) 
            : { seconds: Math.floor(newTimeoutMillis / 1000), nanoseconds: 0 }; 
        const timeString = new Date().toLocaleTimeString();
        
        let userNote = `${userName} (${timeString}): ${trimmedReply}`;
        
        const newNotes = [...(Array.isArray(currentNotes) ? currentNotes : []), userNote];

        try {
            await handleUserReply(orderId, newNotes, newOrderTimeout);
            console.log(`Successfully extended orderTimeout for order: ${orderId} to ${new Date(newTimeoutMillis).toLocaleString()}`);
            setReplyText(prev => ({ ...prev, [orderId]: '' }));

        } catch (error) {
            console.error("Error sending user message:", error);
            alert("Failed to send message. Please try again.");
        } finally {
            setIsSaving(prev => ({ ...prev, [orderId]: false }));
        }
    };
    
    const visible = userOrders.filter((o) => o.orderConfirmed !== false);

    if (visible.length === 0) {
        return <p className="text-gray-600 italic">No current orders found.</p>;
    }

    const sortedVisibleOrders = [...visible].sort((b, a) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
    });

    return (
        <div className="space-y-4">
            {sortedVisibleOrders.map((order, index) => {
                const orderId = order.orderId;
                let estimatedPreppedTime = null;
                let estimatedPickUpTime = null;
                let estimatedDeliveryTime = null;
                const saving = isSaving[orderId];
                const canReply = order.orderConfirmed !== true; 
                const canConfirm = order.orderCompleted == true;
                const containerClassName = order.orderConfirmed === true
                    ? "border-2 border-green-500 rounded p-4 bg-green-50 shadow-md"
                    : "border rounded p-4 bg-yellow-50 border-yellow-300 text-yellow-800 shadow-sm";
                if (order.orderConfirmed === true) {
                    estimatedPreppedTime = order.estimatedPreppedTime?.toDate() ?? null;
                    estimatedPickUpTime = order.estimatedPickUpTime?.toDate() ?? null;
                    estimatedDeliveryTime = order.estimatedDeliveryTime?.toDate() ?? null;
                }

                return (
                    <div key={orderId || index}
                        className={containerClassName}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex-grow pr-4"> 
                                <p><strong>OrderId:</strong> {order.orderId}</p>
                                <p><strong>Status:</strong> {order.deliveryStatus}</p>
                                <p><strong>Restaurant:</strong> {order.fromRestaurant} <span className="mb-2">— {order.restaurantAddress}</span></p>
                                <p><strong>Total:</strong> ${Number(order.payment ?? 0).toFixed(2)}</p>
                                <p>
                                    <strong>Estimated Prepped / Pickup / Delivery Time:</strong> 
                                    <span className="font-medium text-blue-600"> {formatEstimatedTime(estimatedPreppedTime)} / {formatEstimatedTime(estimatedPickUpTime)} / {formatEstimatedTime(estimatedDeliveryTime)} </span>
                                </p>
                            </div>

                            {/* --- TIME BANNER (TOP-RIGHT) --- */}
                            <div className="bg-yellow-400 text-yellow-900 text-med font-bold py-2 px-3 rounded-tr rounded-bl shadow-md z-10 -mt-4 -mr-4">
                                <div className="text-gray-800 font-normal mb-1">
                                    <strong>Placed:</strong>{" "}
                                    {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleTimeString() : "N/A"}
                                </div>
                            </div>
                        </div> 
                        
                        {/* Items Section (Kept for completeness) */}
                        <div className="mt-4 pt-2 border-t border-gray-200">
                            <strong className="block mb-1 text-base">Items:</strong>
                            <ul className="ml-0 space-y-2 text-sm">
                                {order.items?.map((item, idx) => (
                                    <li key={idx} className="py-1 px-2 border rounded bg-gray-50">
                                        <p className="font-medium">{item.name} (<span className="text-grey-600">x{item.quantity}</span>)</p>
                                        {(item.selectedMods && item.selectedMods.length > 0) && (
                                            <ul className="list-disc list-inside ml-4 text-xs text-gray-700 mt-1">
                                                {item.selectedMods.map((mod, modIdx) => (
                                                    <li key={modIdx}>{mod.name} {mod.price > 0 && <span className="font-mono ml-1 text-gray-500">(+${mod.price.toFixed(2)})</span>}</li>
                                                ))}
                                            </ul>
                                        )}
                                        {(item.requirements && item.requirements.trim() !== "") && (
                                            <p className="mt-1 text-xs text-red-600">**Item Note:** {item.requirements}</p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        
                        {/* Order Notes / Messages Section */}
                        {Array.isArray(order.restaurantNote) && order.restaurantNote.length > 0 && (
                            <div className="mt-4 pt-2 border-t border-gray-200">
                                <strong className="block mb-1 text-base">Order Note:</strong>
                                <ul className="space-y-3">
                                    {order.restaurantNote.map((note, noteIdx) => {
                                        const noteContent = (note && typeof note === 'string') ? note.trim() : '';
                                        if (noteContent === "") return null;

                                        let noteClass;
                                        if (noteContent.startsWith(`${order.fromRestaurant}`)) {
                                            noteClass = "bg-red-100 border-red-300 text-red-800";
                                        } else if (noteContent.startsWith(`${userName}`)) {
                                            noteClass = "bg-blue-100 border-blue-300 text-blue-800"; 
                                        } else {
                                            noteClass = "bg-gray-100 border-gray-300 text-gray-800"; 
                                        }

                                        return (
                                            <li key={noteIdx} className={`text-sm p-2 rounded border ${noteClass}`}>
                                                <p className="font-medium whitespace-pre-wrap">{noteContent}</p>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}

                        {/* 4. Conditional User Reply Textarea and Button */}
                        {canReply && (
                            <div className="mt-4 pt-2 border-t border-gray-200">
                                <strong className="mb-2 block">Message to Restaurant:</strong>
                                <textarea
                                    value={replyText[orderId] || ''}
                                    onChange={(e) => setReplyText({ ...replyText, [orderId]: e.target.value })}
                                    className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                                    rows="2"
                                    placeholder="Type your message here..."
                                    disabled={saving}
                                />
                                <button
                                    onClick={() => handleLocalReply(orderId, order.restaurantNote, replyText[orderId] || '')}
                                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium transition-colors w-full mt-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                    disabled={saving || !replyText[orderId] || replyText[orderId].trim() === ''}
                                >
                                    {saving ? 'Sending Message...' : 'Send Message'}
                                </button>
                            </div>
                        )}
                        {canConfirm && (
                        <div>
                            <button
                            onClick={() => handleConfirmation(orderId)}
                            className="mt-3 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out"
                            >
                            Confirm Delivery
                            </button>
                        </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}