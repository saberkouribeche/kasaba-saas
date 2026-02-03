"use client";
import { useState } from 'react';
import { X, Banknote, CheckCircle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, increment, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { notify } from '@/lib/notify';
import { addTreasuryTransaction } from "@/services/treasuryService";
import { getOpenShift } from "@/services/shiftService";

export default function SupplierPaymentModal({ isOpen, onClose, supplier }) {
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [loading, setLoading] = useState(false);

    if (!isOpen || !supplier) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        const paymentAmount = Number(amount);

        if (!paymentAmount || paymentAmount <= 0) {
            notify.error("الرجاء إدخال مبلغ صحيح");
            return;
        }

        setLoading(true);
        try {
            // 1. Add Transaction Record
            await addDoc(collection(db, `suppliers/${supplier.id}/transactions`), {
                type: 'payment', // We paid money
                amount: paymentAmount,
                note: note || 'تسديد دفعة',
                createdAt: serverTimestamp()
            });

            // 2. Update Supplier Debt (Decrease)
            const supplierRef = doc(db, 'suppliers', supplier.id);
            await updateDoc(supplierRef, {
                debt: increment(-paymentAmount),
                lastTransactionDate: serverTimestamp()
            });

            // 3. Record Treasury Transaction (Money OUT)
            let activeShiftId = null;
            try {
                const shift = await getOpenShift();
                if (shift) activeShiftId = shift.id;
            } catch (e) { console.warn("Shift check failed", e); }

            await addTreasuryTransaction({
                type: paymentMethod,
                operation: 'debit', // Money leaving
                amount: paymentAmount,
                source: 'supplier_payment',
                destination: paymentMethod === 'cash' ? 'drawer' : 'bank',
                description: `دفع للمورد: ${supplier.name} (${note || 'تسديد'})`,
                relatedId: supplier.id,
                shiftId: activeShiftId
            });

            notify.success(`تم تسجيل تسديد ${paymentAmount} دج`);
            setAmount('');
            setNote('');
            onClose();
        } catch (error) {
            console.error(error);
            notify.error("حدث خطأ أثناء تسجيل الدفع");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-50 transition"
                >
                    <X size={24} />
                </button>

                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Banknote size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800">تسجيل تسديد للمورد</h2>
                    <p className="text-sm text-slate-500 font-bold mt-1">{supplier.name}</p>
                    <p className="text-xs text-red-500 font-bold mt-2 bg-red-50 px-3 py-1 rounded-full inline-block">
                        الدين الحالي: {Number(supplier.debt || 0).toLocaleString()} دج
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">المبلغ المدفوع (دج)</label>
                        <div className="relative">
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full text-2xl font-black text-center bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition"
                                placeholder="0"
                                required
                            />
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">دج</div>
                        </div>
                    </div>

                    {/* Payment Method */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setPaymentMethod('cash')}
                            className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 font-bold transition ${paymentMethod === 'cash'
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                                }`}
                        >
                            <Banknote size={20} />
                            نقداً (الخزنة)
                        </button>
                        <button
                            type="button"
                            onClick={() => setPaymentMethod('bank')}
                            className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 font-bold transition ${paymentMethod === 'bank'
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                                }`}
                        >
                            <Banknote size={20} />
                            بنكي
                        </button>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">ملاحظة</label>
                        <input
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
                            placeholder="مثال: تسديد نقدي، شيك..."
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-black text-lg shadow-lg shadow-emerald-200 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? "جاري الحفظ..." : "تأكيد التسديد"}
                    </button>
                </form>
            </div>
        </div>
    );
}
