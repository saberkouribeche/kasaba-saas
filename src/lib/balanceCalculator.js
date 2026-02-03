import { db } from "./firebase";
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";

/**
 * Recalculates the balance for a customer by summing all their transactions
 * @param {string} customerId - The customer's phone number (used as ID)
 * @returns {Promise<number>} The calculated balance
 */
export async function recalculateCustomerBalance(customerId) {
    try {
        // 0. Get Customer to find phone (for Orders)
        // Wait, looking at StatementModal, orders are queried by phone.
        // We assume customerId is the Firestore User ID.
        let customerPhone = null;
        try {
            const { getDoc, doc } = await import("firebase/firestore"); // Import if needed inside, but top level is better. Assuming imports exist.
            const userSnap = await getDoc(doc(db, "users", customerId));
            if (userSnap.exists()) {
                customerPhone = userSnap.data().phone;
            }
        } catch (e) { console.log("Could not fetch user phone for balance calc", e); }


        // 1. Query all TRANSACTIONS for this customer (Manual Invoices & General Payments)
        const txQuery = query(
            collection(db, "transactions"),
            where("userId", "==", customerId)
        );

        // 2. Query all ORDERS (if phone exists)
        let orderDocs = [];
        if (customerPhone) {
            const orderQuery = query(
                collection(db, "order"),
                where("customer_phone", "==", customerPhone)
            );
            const orderSnap = await getDocs(orderQuery);
            orderDocs = orderSnap.docs;
        }

        const txSnap = await getDocs(txQuery);

        // 3. Calculate balance
        let balance = 0;
        const linkedOrderIds = new Set();

        // Process Transactions (Manual)
        txSnap.docs.forEach(docSnap => {
            const tx = docSnap.data();
            const amount = Number(tx.amount || 0);
            const paidInternal = Math.max(Number(tx.paymentAmount || 0), Number(tx.total_paid || 0));

            if (tx.orderId) {
                linkedOrderIds.add(tx.orderId);
            }

            if (tx.type === "ORDER_PLACED" || tx.type === "invoice") {
                balance += amount; // Add to debt
                balance -= paidInternal; // Subtract what's paid inside it
            } else if (tx.type === "PAYMENT_RECEIVED" || tx.type === "payment") {
                balance -= amount; // Reduce debt
            }
        });

        // Process Orders (System) - ONLY if not already processed via a transaction link
        orderDocs.forEach(docSnap => {
            const order = docSnap.data();
            // Skip if this order is already accounted for in a transaction
            if (linkedOrderIds.has(docSnap.id) || linkedOrderIds.has(order.order_number)) return;

            const total = Number(order.order_total || 0);
            const paid = Number(order.total_paid || 0);

            balance += total;
            balance -= paid;
        });

        // 4. Update the customer's currentDebt field
        const userRef = doc(db, "users", customerId);
        await updateDoc(userRef, {
            currentDebt: balance,
            lastBalanceUpdate: serverTimestamp()
        });

        return balance;
    } catch (error) {
        console.error("Error recalculating balance:", error);
        throw error;
    }
}
