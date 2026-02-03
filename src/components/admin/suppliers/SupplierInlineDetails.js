"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, limit, addDoc, serverTimestamp, updateDoc, doc, increment } from "firebase/firestore";
import { Loader2, Plus, FileText, Banknote, AlertCircle, ArrowRight } from "lucide-react";
import { notify } from "@/lib/notify";
import Link from "next/link";

export default function SupplierInlineDetails({ supplier, onClose }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [quickAmount, setQuickAmount] = useState("");
    const [quickNote, setQuickNote] = useState("");
    const [actionType, setActionType] = useState('payment'); // 'payment' | 'invoice'

    // Fetch last 5 transactions for quick view
    useEffect(() => {
        if (!supplier?.id) return;
        const q = query(
            collection(db, `suppliers/${supplier.id}/transactions`),
            orderBy("createdAt", "desc"),
            limit(5)
        );
        const unsub = onSnapshot(q, (snap) => {
            setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
        return () => unsub();
    }, [supplier.id]);

    const handleQuickAction = async (e) => {
        e.preventDefault();
        if (!quickAmount) return;

        try {
            const amount = Number(quickAmount);
            // 1. Add Transaction
            await addDoc(collection(db, `suppliers/${supplier.id}/transactions`), {
                type: actionType,
                amount: amount,
                note: quickNote || (actionType === 'payment' ? 'دفعة سريعة' : 'فاتورة سريعة'),
                createdAt: serverTimestamp()
            });

            // 2. Update Debt
            // Payment decreases debt (-), Invoice increases debt (+)
            const change = actionType === 'payment' ? -amount : amount;
            await updateDoc(doc(db, "suppliers", supplier.id), {
                debt: increment(change),
                lastTransactionDate: serverTimestamp()
            });

            notify.success("تم تسجيل العملية");
            setQuickAmount("");
            setQuickNote("");
        } catch (err) {
            console.error(err);
            notify.error("فشل العملية");
        }
    };

    return (
        <div className="bg-slate-50 p-6 rounded-b-[32px] shadow-inner border-t border-slate-200 animate-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* 1. Quick Info & Actions */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <h4 className="font-bold text-slate-400 text-xs mb-2">الدين الحالي</h4>
                        <div className={`text-3xl font-black ${supplier.debt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {Number(supplier.debt).toLocaleString()} <span className="text-sm">دج</span>
                        </div>
                    </div>

                    <form onSubmit={handleQuickAction} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-3">
                        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                            <button
                                type="button"
                                onClick={() => setActionType('payment')}
                                className={`flex-1 py-2 text-xs font-black rounded-lg transition ${actionType === 'payment' ? 'bg-emerald-500 text-white shadow' : 'text-slate-500 hover:bg-white'}`}
                            >
                                تسجيل دفعة
                            </button>
                            <button
                                type="button"
                                onClick={() => setActionType('invoice')}
                                className={`flex-1 py-2 text-xs font-black rounded-lg transition ${actionType === 'invoice' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-white'}`}
                            >
                                فاتورة جديدة
                            </button>
                        </div>
                        <input
                            type="number"
                            placeholder="المبلغ (دج)"
                            className="w-full p-3 bg-slate-50 rounded-xl font-black text-center text-lg outline-none focus:ring-2 focus:ring-slate-200"
                            value={quickAmount}
                            onChange={(e) => setQuickAmount(e.target.value)}
                        />
                        <input
                            type="text"
                            placeholder="ملاحظة..."
                            className="w-full p-3 bg-slate-50 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-slate-200"
                            value={quickNote}
                            onChange={(e) => setQuickNote(e.target.value)}
                        />
                        <button className={`w-full py-3 rounded-xl font-bold text-white shadow-lg ${actionType === 'payment' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                            تأكيد
                        </button>
                    </form>

                    <Link href={`/admin/suppliers/${supplier.id}`} className="flex items-center justify-center gap-2 w-full py-3 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition">
                        عرض التفاصيل الكاملة <ArrowRight size={16} />
                    </Link>
                </div>

                {/* 2. Recent Transactions Table */}
                <div className="lg:col-span-2">
                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <FileText size={18} className="text-slate-400" />
                        آخر 5 عمليات
                    </h4>

                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" /></div>
                    ) : transactions.length > 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                            <table className="w-full text-sm text-right">
                                <thead className="bg-slate-50 text-slate-500 font-bold text-xs">
                                    <tr>
                                        <th className="px-4 py-3">التاريخ</th>
                                        <th className="px-4 py-3">النوع</th>
                                        <th className="px-4 py-3">المبلغ</th>
                                        <th className="px-4 py-3">ملاحظات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {transactions.map(tx => (
                                        <tr key={tx.id} className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3 font-medium text-slate-600">
                                                {tx.createdAt?.toDate().toLocaleDateString('ar-DZ')}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-md text-[10px] font-black ${tx.type === 'payment' ? 'bg-emerald-100 text-emerald-700' :
                                                        tx.type === 'invoice' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                                                    }`}>
                                                    {tx.type === 'payment' ? 'دفعة' : tx.type === 'invoice' ? 'فاتورة' : 'أخرى'}
                                                </span>
                                            </td>
                                            <td className={`px-4 py-3 font-black dir-ltr text-right ${tx.type === 'payment' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {Number(tx.amount).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 truncate max-w-[150px]">
                                                {tx.note || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-10 text-slate-400 font-bold bg-slate-50/50 rounded-2xl border-dashed border-2 border-slate-100">
                            لا توجد عمليات سابقة
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
