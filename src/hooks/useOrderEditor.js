import { useState } from 'react';
import { db } from '@/lib/firebase';
import { runTransaction, doc, increment, serverTimestamp } from 'firebase/firestore';
import { CONFIG } from '@/config';

export function useOrderEditor() {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    /**
     * Save Order Changes Atomically (Undo Old -> Redo New)
     * @param {string} orderId 
     * @param {object} oldOrder - The original order state
     * @param {object} newOrderData - The updated order state
     * @param {string} collectionName - 'order' or 'transactions'
     */
    const saveChanges = async (orderId, oldOrder, newOrderData, collectionName = 'order') => {
        setSaving(true);
        setError(null);
        try {
            await runTransaction(db, async (transaction) => {

                // --- STEP 1: REVERT OLD STATE (The "Undo") ---

                // A. Inventory Revert (Add back old items)
                if (CONFIG.ENABLE_INVENTORY_MANAGEMENT !== false) {
                    const oldItems = oldOrder.order_items || [];
                    for (const item of oldItems) {
                        // Check if item tracks stock (default true unless explicitly false)
                        if (item.trackStock !== false) {
                            const productRef = doc(db, 'product', item.id || item.product_id); // 'product' collection
                            const productDoc = await transaction.get(productRef);

                            if (productDoc.exists()) {
                                const currentStock = Number(productDoc.data().stock || 0);
                                const qtyToRestore = Number(item.quantity || 0);
                                transaction.update(productRef, { stock: currentStock + qtyToRestore });
                            }
                        }
                    }
                }

                // B. Debt Revert (Remove old debt logic)
                // Only if user is registered (clientId/userId exists)
                const userId = oldOrder.userId || oldOrder.clientId || oldOrder.customer_id;
                if (userId) {
                    const userRef = doc(db, 'users', userId);
                    const userDoc = await transaction.get(userRef);
                    if (userDoc.exists()) {
                        // Calculate Net Debt of Old Order (Total - Paid)
                        const oldTotal = Number(oldOrder.order_total || oldOrder.totalAmount || 0);
                        const oldPaid = Number(oldOrder.paidAmount || 0);
                        const oldDebtEffect = oldTotal - oldPaid;

                        // We subtract this effect to "undo" it
                        transaction.update(userRef, { currentDebt: increment(-oldDebtEffect) });
                    }
                }

                // --- STEP 2: APPLY NEW STATE (The "Redo") ---

                // A. Inventory Apply (Deduct new items)
                if (CONFIG.ENABLE_INVENTORY_MANAGEMENT !== false) {
                    const newItems = newOrderData.order_items || [];
                    for (const item of newItems) {
                        if (item.trackStock !== false) {
                            const productRef = doc(db, 'product', item.id || item.product_id);
                            const productDoc = await transaction.get(productRef); // Read again for consistency

                            if (!productDoc.exists()) {
                                throw new Error(`المنتج غير موجود: ${item.title || item.name}`);
                            }

                            const currentStock = Number(productDoc.data().stock || 0);
                            const qtyToDeduct = Number(item.quantity || 0);
                            const newStock = currentStock - qtyToDeduct;

                            // Check Negative Stock Rule
                            if (CONFIG.ALLOW_NEGATIVE_STOCK === false && newStock < 0) {
                                throw new Error(`الكمية غير متوفرة للمنتج: ${item.title || item.name} (المتوفر: ${currentStock})`);
                            }

                            transaction.update(productRef, { stock: newStock });
                        }
                    }
                }

                // B. Debt Apply (Add new debt logic)
                if (userId) {
                    const userRef = doc(db, 'users', userId);
                    // Calculate Net Debt of New Order
                    const newTotal = Number(newOrderData.order_total || 0);
                    const newPaid = Number(newOrderData.paidAmount || 0);
                    const newDebtEffect = newTotal - newPaid;

                    transaction.update(userRef, {
                        currentDebt: increment(newDebtEffect),
                        // Optionally update totalDebt if desired, but sticking to net balance for now
                    });
                }

                // --- STEP 3: UPDATE DOCUMENT ---
                const orderRef = doc(db, collectionName, orderId);
                transaction.update(orderRef, {
                    ...newOrderData,
                    updated_at: serverTimestamp(),
                    last_edited_by: 'admin' // Could use context if available
                });
            });

            return true;
        } catch (err) {
            console.error("Order Edit Failed:", err);
            setError(err.message || "فشل حفظ التعديلات");
            throw err;
        } finally {
            setSaving(false);
        }
    };

    return { saveChanges, saving, error };
}
