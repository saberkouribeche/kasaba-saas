"use client";
import { useState } from 'react';
import { X, Trash2, Calendar, Clock, DollarSign, AlertCircle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, increment, arrayRemove } from 'firebase/firestore';
import { notify } from '@/lib/notify';
import { recalculateCustomerBalance } from '@/lib/balanceCalculator';

export default function InvoicePaymentsModal({ isOpen, onClose, invoice, client, onSuccess }) {
    const [loading, setLoading] = useState(false);

    if (!isOpen || !invoice) return null;

    // We only show payments stored in the 'payments' array (added via the wallet button)
    const payments = invoice.payments || [];
    // Also consider 'preview' fake payments if we want, but for now just the array.

    // Sort buy date desc
    const sortedPayments = [...payments].sort((a, b) => {
        const tA = a.date?.seconds || 0;
        const tB = b.date?.seconds || 0;
        return tB - tA;
    });

    const handleDelete = async (payment) => {
        if (!await notify.confirm("حذف الدفعة", "هل أنت متأكد من حذف هذه الدفعة؟")) return;

        setLoading(true);
        try {
            // Determine Collection
            // From StatementModal: source can be 'order', 'tx', or 'merged' properties.
            let collectionName = 'transactions';
            if (invoice.source === 'order' || invoice.order_number) collectionName = 'order';
            if (invoice.source === 'tx') collectionName = 'transactions';
            // Fallback check
            if (invoice._collection) collectionName = invoice._collection;

            const docRef = doc(db, collectionName, invoice.id);

            await updateDoc(docRef, {
                payments: arrayRemove(payment),
                total_paid: increment(-Number(payment.amount))
            });

            await recalculateCustomerBalance(client.id);

            notify.success("تم حذف الدفعة");
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error(error);
            notify.error("حدث خطأ أثناء الحذف");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="bg-slate-900 px-6 py-5 flex justify-between items-center text-white">
                    <div>
                        <h3 className="text-lg font-black flex items-center gap-2">
                            سجل الدفعات
                        </h3>
                        <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">
                            للفاتورة: {invoice.order_number ? `#${invoice.order_number}` : (invoice.notes || 'يدوية')}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                    {sortedPayments.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm font-bold">لا توجد دفعات إضافية مسجلة</p>
                            {invoice.paymentAmount > 0 && (
                                <p className="text-xs mt-1 text-emerald-600">
                                    (يوجد دفعة أولية بقيمة {Number(invoice.paymentAmount).toLocaleString()} دج مسجلة مع الفاتورة)
                                </p>
                            )}
                        </div>
                    ) : (
                        sortedPayments.map((p, idx) => {
                            const pDate = p.date?.toDate ? p.date.toDate() : new Date();
                            return (
                                <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center justify-between group">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-black text-emerald-600 text-lg dir-ltr">
                                                {Number(p.amount).toLocaleString()} <span className="text-xs">دج</span>
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-slate-400 font-bold">
                                            <span className="flex items-center gap-1"><Calendar size={12} /> {pDate.toLocaleDateString('en-GB')}</span>
                                            <span className="flex items-center gap-1"><Clock size={12} /> {pDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        {p.notes && <p className="text-xs text-slate-600 mt-1 font-medium">{p.notes}</p>}
                                    </div>

                                    <button
                                        onClick={() => handleDelete(p)}
                                        disabled={loading}
                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
                                        title="حذف الدفعة"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
