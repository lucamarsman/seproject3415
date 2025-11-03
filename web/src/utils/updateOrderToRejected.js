// utils/updateOrderToRejected.js
import {
  doc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
  runTransaction,
  getDoc, // Needed for the initial check outside the transaction
} from "firebase/firestore";
import { db } from "../firebase";


export async function updateOrderToRejected(restaurantId, orderId) {
  const orderDocRef = doc(db, "restaurants", restaurantId, "restaurantOrders", orderId);
  let userId;
  let messageText;
  let existingMessageFound = false;
  let messageWasCreated = false;
  let messagesRef;

  try {
    // --- PRE-CHECK: 1️⃣ Get userId and check for existing message (Non-Atomic) ---
    const initialOrderSnapshot = await getDoc(orderDocRef);
    if (!initialOrderSnapshot.exists()) {
      console.warn(`Order ${orderId} not found for auto-rejection.`);
      return { success: false, messageCreated: false };
    }
    userId = initialOrderSnapshot.data().userId;

    if (userId) {
      messagesRef = collection(db, "users", userId, "messages");
      // Perform the message check OUTSIDE the transaction for efficiency
      const existingMsgQuery = query(messagesRef, where("orderId", "==", orderId));
      const existingMsgSnap = await getDocs(existingMsgQuery);

      if (!existingMsgSnap.empty) {
        console.log(`✅ Timeout message already exists for order ${orderId}, skipping message creation.`);
        existingMessageFound = true;
      }
    }

    // --- ATOMIC OPERATION: Use a Transaction for the critical Order Update ---
    await runTransaction(db, async (transaction) => {
      // 2️⃣ READ the order document (using transaction.get) ... (unchanged)
      const orderSnapshot = await transaction.get(orderDocRef);
      if (!orderSnapshot.exists()) {
        console.warn(`Order ${orderId} missing inside transaction.`);
        throw new Error("OrderNotFound"); 
      }
      // 3️⃣ UPDATE the order status ... (unchanged)
      transaction.update(orderDocRef, {
        orderConfirmed: false,
        deliveryStatus: "Auto-rejected: Order timed out.",
      });

      if (userId && !existingMessageFound) {
        // 4️⃣ Send new message to user (Atomic Set)
        messageText = "Your order timed out and could not be fulfilled. Refund has been initiated.";
        const newMessageRef = doc(messagesRef); 
        transaction.set(newMessageRef, {
          createdAt: serverTimestamp(),
          message: messageText,
          read: false,
          type: "order_status",
          orderId,
        });

        messageWasCreated = true; // 👈 SET NEW FLAG
        console.log(`📩 Transaction: Timeout message prepared for user ${userId}.`);
      }
    });

    console.log(`⏰ Order ${orderId} auto-rejected due to timeout.`);
    return { success: true, userId, message: messageText, messageCreated: messageWasCreated }; // 👈 RETURN NEW FLAG
  } catch (err) {
    if (err.message === "OrderNotFound") {
      return { success: false, messageCreated: false };
    }
    console.error(`❌ Failed to auto-reject order ${orderId}:`, err);
    return { success: false, messageCreated: false };
  }
}
   