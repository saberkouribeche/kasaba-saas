import { useState } from 'react';
import { db } from '@/lib/firebase';
import { runTransaction, doc, collection, serverTimestamp, increment } from 'firebase/firestore';
import { CONFIG } from '@/config';

/**
 * Hook for Atomic Invoice Submission
 * Ensures Data Integrity: Stock Deduct + Invoice Create + User Debt + Treasury
 */
export function useInvoiceSubmit() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    /**
     * Submit Invoice Transaction
     * @param {Object} invoiceData - { userId, amount, order_items, notes, ... }
     * @param {Object} client - User object { id, currentDebt, ... }
     * @param {number} paidAmount - Amount paid immediately (affects Treasury)
     */
    const submit = async (invoiceData, client, paidAmount = 0) => {
        setLoading(true);
        setError(null);
        try {
            await runTransaction(db, async (transaction) => {
                // 1. READ Phase: Fetch latest Product Docs
                const itemsStr = JSON.stringify(invoiceData.order_items || []);
                const items = JSON.parse(itemsStr); // Deep copy

                if (items.length > 0 && CONFIG.ENABLE_INVENTORY_MANAGEMENT !== false) {
                    const productReads = items.map(item => transaction.get(doc(db, 'product', item.id)));
                    const productDocs = await Promise.all(productReads);

                    // 2. VALIDATION Phase: Check Stock
                    productDocs.forEach((docSnap, idx) => {
                        if (!docSnap.exists()) {
                            throw new Error(`Product not found: ${items[idx].title}`);
                        }

                        const productData = docSnap.data();
                        // Skip check if tracking is explicitly disabled for this product
                        if (productData.trackStock === false) return;

                        const currentStock = Number(productData.stock || 0);
                        const requestedQty = Number(items[idx].quantity || 0);
                        const newStock = currentStock - requestedQty;

                        // Negative Stock Rule
                        if (newStock < 0 && CONFIG.ALLOW_NEGATIVE_STOCK === false) {
                            throw new Error(`نفذت الكمية للمنتج: ${items[idx].title} (المتوفر: ${currentStock})`);
                        }

                        // 3. QUEUE STOCK UPDATE
                        // Only update if we are tracking stock
                        transaction.update(docSnap.ref, { stock: newStock });
                    });
                }

                // 4. CREATE INVOICE (Transaction)
                const newInvoiceRef = doc(collection(db, 'transactions'));
                transaction.set(newInvoiceRef, {
                    ...invoiceData,
                    paidAmount: Number(paidAmount),
                    remainingAmount: Number(invoiceData.amount) - Number(paidAmount),
                    createdAt: serverTimestamp(),
                    timestamp: Date.now()
                });

                // 5. UPDATE USER DEBT
                // Standard Accounting: Net Debt Change = Total - Paid
                const netDebtChange = Number(invoiceData.amount) - Number(paidAmount);

                const clientRef = doc(db, 'users', client.id);
                transaction.update(clientRef, {
                    currentDebt: increment(netDebtChange),
                    totalDebt: increment(invoiceData.amount), // Lifetime sales
                    lastTransactionDate: serverTimestamp()
                });

                // 6. UPDATE TREASURY (If Paid)
                if (paidAmount > 0) {
                    const treasuryRef = doc(collection(db, 'treasury_transactions'));
                    transaction.set(treasuryRef, {
                        type: 'cash', // Default to Safe
                        operation: 'credit', // Inflow
                        amount: Number(paidAmount),
                        source: 'manual_invoice',
                        description: `دفعة فورية لفاتورة ${client.fullName || ''}`,
                        relatedId: newInvoiceRef.id,
                        userId: client.id,
                        createdAt: serverTimestamp(),
                        date: serverTimestamp()
                    });
                }
            });

            return true; // Success
        } catch (err) {
            console.error("Transaction Failed:", err);
            setError(err.message);
            throw err; // Re-throw for UI handling
        } finally {
            setLoading(false);
        }
    };

    return { submit, loading, error };
}
