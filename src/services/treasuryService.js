import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs, onSnapshot, where } from "firebase/firestore";

const TREASURY_COLLECTION = "treasury_transactions";
const SNAPSHOT_COLLECTION = "financial_snapshots";

/**
 * Add a Treasury Transaction
 * Records money moving in or out of the Safe or Bank.
 * 
 * @param {Object} txData
 * @param {string} txData.type - 'cash' (Safe) | 'bank' (Bank)
 * @param {string} txData.operation - 'credit' (In) | 'debit' (Out)
 * @param {number} txData.amount - Amount
 * @param {string} txData.source - 'b2b_payment' | 'manual_deposit' | 'expense' | 'supplier_payment'
 * @param {string} txData.description - Description
 * @param {string} [txData.relatedId] - Optional ID (e.g., client ID, order ID)
 */
export const addTreasuryTransaction = async ({ type, operation, amount, source, destination = 'safe', description, relatedId = null, shiftId = null }) => {
    if (!amount || isNaN(amount)) throw new Error("Invalid amount");

    await addDoc(collection(db, TREASURY_COLLECTION), {
        type, // 'cash' (Safe/Drawer) or 'bank'
        operation, // 'credit' or 'debit'
        amount: Number(amount),
        source, // 'b2b_payment', 'daily_sales', etc.
        destination, // 'safe', 'bank', 'drawer'
        shiftId, // Link to daily shift
        description,
        relatedId,
        createdAt: serverTimestamp(),
        date: serverTimestamp()
    });
};

/**
 * Get Treasury Transactions (Real-time listener)
 * @param {Function} callback - Function to set state
 * @param {number} limitCount - Number of recent items to fetch
 * @returns {Function} Unsubscribe function
 */
export const subscribeToTreasury = (callback, limitCount = 50) => {
    const q = query(
        collection(db, TREASURY_COLLECTION),
        orderBy("createdAt", "desc"),
        limit(limitCount)
    );

    return onSnapshot(q, (snapshot) => {
        const transactions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            // Helper for formatted date
            formattedDate: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date()
        }));

        // Calculate totals locally from the full history if needed, 
        // but for safety/performance we might want to aggregate separate docs or use a 'stats' doc.
        // For now, let's assume we maintain a 'stats' doc OR calculate locally if dataset is small.
        // Given User request implies "Real-time", local calc of small dataset is risky.
        // Let's rely on a separate aggregation listener or just calc from fetched docs for the *visible* logic,
        // BUT for the "Total Cash/Bank", we really should iterate all. 
        // For MVP, we will fetch ALL treasury txs to calculate balance (careful with scale).

        callback(transactions);
    });
};

/**
 * Subscribe to Treasury Balances
 * Since we don't have a 'balance' doc yet, we'll fetch all transactions to sum them up.
 * OPTIMIZATION TODO: Create a 'treasury_stats' singleton document that increments/decrements.
 */
export const subscribeToTreasuryBalance = (callback) => {
    // Fetch ALL to calculate sum (Caution: Scaling issue eventually)
    // For now, it's the safest way to get accurate 'Live' data without cloud functions.
    const q = query(collection(db, TREASURY_COLLECTION));

    return onSnapshot(q, (snapshot) => {
        let cash = 0;
        let bank = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            const amt = Number(data.amount) || 0;

            if (data.type === 'cash') {
                if (data.operation === 'credit') cash += amt;
                else cash -= amt;
            } else if (data.type === 'bank') {
                if (data.operation === 'credit') bank += amt;
                else bank -= amt;
            }
        });

        callback({ cash, bank });
    });
};

/**
 * Save Financial Snapshot
 * Records the current state of all metrics for historical charting.
 */
export const saveFinancialSnapshot = async (stats) => {
    await addDoc(collection(db, SNAPSHOT_COLLECTION), {
        ...stats,
        savedAt: serverTimestamp()
    });
};
