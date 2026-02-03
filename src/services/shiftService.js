import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, timestamp, orderBy, limit } from "firebase/firestore";
import { addTreasuryTransaction } from "./treasuryService";

const SHIFTS_COLLECTION = "daily_shifts";
const TREASURY_COLLECTION = "treasury_transactions";

/**
 * Start a New Shift
 * @param {number} openingAmount - Cash in drawer at start
 * @param {string} openedBy - User ID
 */
export const startShift = async (openingAmount, openedBy) => {
    // 1. Check if there's already an open shift
    const existing = await getOpenShift();
    if (existing) throw new Error("There is already an open shift.");

    if (isNaN(openingAmount) || openingAmount < 0) throw new Error("Invalid opening amount");

    // 2. Create Shift Document
    const shiftRef = await addDoc(collection(db, SHIFTS_COLLECTION), {
        status: 'open',
        openedBy,
        openingAmount: Number(openingAmount),
        openedAt: serverTimestamp(),
        // Initialize stats
        totalExpenses: 0,
        totalB2BCollected: 0,
        calculatedNetSales: 0
    });

    return shiftRef.id;
};

/**
 * Get Currently Open Shift
 */
export const getOpenShift = async () => {
    const q = query(
        collection(db, SHIFTS_COLLECTION),
        where("status", "==", "open"),
        limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
};

/**
 * Close Shift & Reconcile
 * @param {string} shiftId 
 * @param {number} closingAmount - Physical cash count
 * @param {string} closedBy - User ID
 */
export const closeShift = async (shiftId, closingAmount, closedBy) => {
    if (isNaN(closingAmount) || closingAmount < 0) throw new Error("Invalid closing amount");

    // 1. Get Shift Data
    const shiftDocRef = doc(db, SHIFTS_COLLECTION, shiftId);
    // Fetch fresh details? For now assume passed ID is valid.
    // Ideally we re-fetch to start calculation.

    // 2. Calculate Totals (Expenses & B2B Payments) for this shift
    // Query Treasury for transactions linked to this shift
    const qTx = query(
        collection(db, TREASURY_COLLECTION),
        where("shiftId", "==", shiftId)
    );
    const snapshot = await getDocs(qTx);

    let totalExpenses = 0;
    let totalB2B = 0;

    snapshot.docs.forEach(d => {
        const tx = d.data();
        const amt = Number(tx.amount || 0);

        // Expense paid from drawer
        if (tx.source === 'expense' && tx.destination === 'drawer') {
            totalExpenses += amt;
        }

        // B2B Payment received into drawer
        if (tx.source === 'b2b_payment' && tx.destination === 'drawer') {
            totalB2B += amt;
        }
    });

    // 3. Get Opening Amount (need to fetch shift doc)
    const shiftSnapshot = await getDocs(query(collection(db, SHIFTS_COLLECTION), where("__name__", "==", shiftId)));
    if (shiftSnapshot.empty) throw new Error("Shift not found");
    const shiftData = shiftSnapshot.docs[0].data();
    const openingAmount = Number(shiftData.openingAmount || 0);

    // 4. THE FORMULA
    // NetSales = (Closing + Expenses) - (Opening + B2B)
    const netDailySales = (Number(closingAmount) + totalExpenses) - (openingAmount + totalB2B);

    // 5. Update Shift
    await updateDoc(shiftDocRef, {
        status: 'closed',
        closedBy,
        items_count: 0, // Placeholder if we track item counts later
        closingAmount: Number(closingAmount),
        closedAt: serverTimestamp(),
        totalExpenses,
        totalB2BCollected: totalB2B,
        calculatedNetSales: netDailySales
    });

    // 6. Record the Net Sales to Treasury (Source: daily_sales)
    // Destination: SAFE (We assume money moves to Safe at night)
    // Or it stays in Safe? Typically "Closing Shift" implies emptying the drawer or counting it.
    // Let's assume the 'Net Sales' is what we record as revenue.

    if (netDailySales > 0) {
        await addTreasuryTransaction({
            type: 'cash',
            operation: 'credit',
            amount: netDailySales,
            source: 'daily_sales',
            destination: 'safe', // Revenue goes to Safe
            description: `Daily Sales (Shift ${new Date().toLocaleDateString()})`,
            shiftId
        });
    }

    return { netDailySales, totalExpenses, totalB2B };
};
