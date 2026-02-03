"use client";
import { useState } from 'react';
import { X, Plus, Save } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { notify } from '@/lib/notify';

export default function AddToTransactionModal({ isOpen, onClose, supplier, transaction }) {
    const [addAmount, setAddAmount] = useState('');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen || !supplier || !transaction) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        const addedValue = Number(addAmount);

        if (!addedValue || addedValue <= 0) {
            notify.error("الرجاء إدخال مبلغ صحيح");
            return;
        }

        setLoading(true);
        try {
            const transactionRef = doc(db, `suppliers/${supplier.id}/transactions`, transaction.id);
            const supplierRef = doc(db, 'suppliers', supplier.id);
            const isInvoice = transaction.type === 'invoice';

            if (isInvoice) {
                // Determine if we are adding a payment to the invoice
                // User said: "Plus button writes in payments".
                // So for an invoice, we add to 'paymentAmount' field inside the invoice doc.
                // This reduces the overall debt.

                await updateDoc(transactionRef, {
                    paymentAmount: increment(addedValue),
                    note: transaction.note ? `${transaction.note} | تم سداد: ${addedValue}` : `تم سداد: ${addedValue}`
                });

                // Decrease Debt (Paying off part of the invoice)
                await updateDoc(supplierRef, {
                    debt: increment(-addedValue),
                    lastTransactionDate: serverTimestamp()
                });

            } else if (transaction.type === 'old_debt' || transaction.type === 'opening_balance') {
                // If it's Old Debt, adding to it means increasing the debt.
                await updateDoc(transactionRef, {
                    amount: increment(addedValue),
                    note: transaction.note ? `${transaction.note} | +${addedValue}` : `+${addedValue}`
                });

                // Increase Debt
                await updateDoc(supplierRef, {
                    debt: increment(addedValue),
                    lastTransactionDate: serverTimestamp()
                });
            } else {
                // Payment: Adding to it means we Paid More.
                // So we increase the amount of the payment record.
                await updateDoc(transactionRef, {
                    amount: increment(addedValue),
                    note: transaction.note ? `${transaction.note} | +${addedValue}` : `+${addedValue}`
                });

                // Decrease Debt (More payment)
                await updateDoc(supplierRef, {
                    debt: increment(-addedValue),
                    lastTransactionDate: serverTimestamp()
                });
            }

            notify.success("تم تحديث العملية بنجاح");
            setAddAmount('');
            setReason('');
            onClose();
        } catch (error) {
            console.error(error);
            notify.error("فشل التحديث");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>

                <h3 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2">
                    <Plus className="text-blue-600" /> {transaction.type === 'invoice' ? 'سداد جزء من الفاتورة' : 'زيادة مبلغ الدفعة'}
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">المبلغ</label>
                        <input
                            type="number"
                            className="w-full text-xl font-bold bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-blue-500"
                            placeholder="0"
                            value={addAmount}
                            onChange={(e) => setAddAmount(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">سبب الإضافة (اختياري)</label>
                        <input
                            type="text"
                            className="w-full text-sm font-medium bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-blue-500"
                            placeholder="مثال: سلع إضافية، خطأ في الحساب..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition"
                        >
                            {loading ? "جاري التحديث..." : "تأكيد الإضافة"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
