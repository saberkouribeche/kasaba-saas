import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";

export function useClientLedger(user) {
    const [transactions, setTransactions] = useState([]);
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.phone) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const txQuery = query(collection(db, "transactions"), where("userId", "==", user.phone));
                const ordersQuery = query(collection(db, "order"), where("customer_phone", "==", user.phone));

                const [txSnapshot, ordersSnapshot] = await Promise.all([getDocs(txQuery), getDocs(ordersQuery)]);

                const txData = txSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), source: 'tx' }));
                const ordersData = ordersSnapshot.docs.map(doc => ({
                    id: doc.id,
                    type: "ORDER_PLACED",
                    amount: Number(doc.data().order_total),
                    created_at: doc.data().created_at,
                    source: 'order',
                    ...doc.data()
                }));

                // Map Orders to Transactions to link details
                const orderMap = new Map();
                ordersData.forEach(o => orderMap.set(o.id.toString(), o));
                ordersData.forEach(o => orderMap.set(o.order_number?.toString(), o));

                const enhancedTxs = txData.map(tx => {
                    if (tx.orderId && orderMap.has(tx.orderId)) {
                        return { ...orderMap.get(tx.orderId), ...tx, source: 'merged' };
                    }
                    return tx;
                });

                const txOrderIds = new Set(enhancedTxs.filter(t => t.orderId).map(t => t.orderId));
                const uniqueOrders = ordersData.filter(o => !txOrderIds.has(o.id));

                const allEvents = [...enhancedTxs, ...uniqueOrders];

                // Sort Ascending (Oldest First)
                allEvents.sort((a, b) => {
                    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.created_at?.toDate ? a.created_at.toDate() : new Date(0));
                    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.created_at?.toDate ? b.created_at.toDate() : new Date(0));
                    return dateA - dateB;
                });

                // Calculate Running Balance
                let runningBalance = 0;
                const eventsWithBalance = allEvents.map(tx => {
                    const isPayment = tx.type === 'PAYMENT_RECEIVED';
                    const amount = Number(tx.amount || 0);
                    // Critical Fix: Account for internal payments (total_paid) within orders
                    const paidInInvoice = Math.max(Number(tx.total_paid || 0), Number(tx.paymentAmount || 0));

                    if (isPayment) {
                        runningBalance -= amount;
                    } else {
                        // For orders/invoices: Add the net debt (Amount - Internal Payment)
                        runningBalance += (amount - paidInInvoice);
                    }
                    return { ...tx, currentBalance: runningBalance, _totalPaidInternal: paidInInvoice };
                });

                setTransactions(eventsWithBalance);
                setBalance(runningBalance);

                // Self-Heal: Update user profile if mismatched (Only on Client)
                if (typeof window !== 'undefined' && user.currentDebt !== runningBalance) {
                    await updateDoc(doc(db, "users", user.phone), {
                        currentDebt: runningBalance
                    });
                }

            } catch (error) {
                console.error("Error fetching ledger:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user?.phone]);

    return { transactions, balance, loading };
}
