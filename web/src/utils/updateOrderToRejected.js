// utils/updateOrderToRejected.js
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Auto-reject a restaurant order due to timeout and send a message to the user (if applicable).
 * Returns data so the UI can update immediately without waiting for Firestore.
 *
 * @param {string} restaurantId - Firestore restaurant document ID
 * @param {string} orderId - Firestore order document ID
 * @returns {Promise<{ success: boolean, userId?: string, message?: string }>}
 */
export async function updateOrderToRejected(restaurantId, orderId) {
  const orderDocRef = doc(db, "restaurants", restaurantId, "restaurantOrders", orderId);

  try {
    // --- 1️⃣ READ the order document ---
    const orderSnapshot = await getDoc(orderDocRef);
    if (!orderSnapshot.exists()) {
      console.warn(`Order ${orderId} not found for auto-rejection.`);
      return { success: false };
    }

    const orderData = orderSnapshot.data();
    const userId = orderData.userId;

    // --- 2️⃣ UPDATE the order status ---
    await updateDoc(orderDocRef, {
      orderConfirmed: false,
      deliveryStatus: "Auto-rejected: Order timed out.",
    });

    let messageText;
    if (userId) {
      // --- 3️⃣ Check if the message already exists ---
      const messagesRef = collection(db, "users", userId, "messages");
      const existingMsgQuery = query(messagesRef, where("orderId", "==", orderId));
      const existingMsgSnap = await getDocs(existingMsgQuery);

      if (existingMsgSnap.empty) {
        // --- 4️⃣ Send new message to user ---
        messageText =
          "Your order timed out and could not be fulfilled. Refund has been initiated.";
        await addDoc(messagesRef, {
          createdAt: serverTimestamp(),
          message: messageText,
          read: false,
          type: "order_status",
          orderId,
        });
        console.log(`📩 Timeout message sent to user ${userId}.`);
      } else {
        console.log(`✅ Timeout message already exists for order ${orderId}, skipping.`);
      }
    }

    console.log(`⏰ Order ${orderId} auto-rejected due to timeout.`);
    return { success: true, userId, message: messageText };
  } catch (err) {
    console.error(`❌ Failed to auto-reject order ${orderId}:`, err);
    return { success: false };
  }
}
