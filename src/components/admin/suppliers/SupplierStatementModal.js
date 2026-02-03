"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { X, FileText, Loader2, Eye, Edit2, Trash2, ArrowUpRight, ArrowDownLeft, Wallet, Image as ImageIcon, Banknote, Plus, MessageCircle } from "lucide-react";
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { notify } from "@/lib/notify";
import { formatPrice } from "@/lib/formatters";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import EditSupplierTransactionModal from "./EditSupplierTransactionModal";
import TransactionDetailsModal from "./TransactionDetailsModal";
import AddToTransactionModal from "@/components/admin/AddToTransactionModal";
import SupplierPaymentModal from "@/components/admin/SupplierPaymentModal";
import TransactionStatusBadge from "@/components/ui/TransactionStatusBadge";
import Link from "next/link";

export default function SupplierStatementModal({ isOpen, onClose, supplier }) {
    useLockBodyScroll(isOpen);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [editingTx, setEditingTx] = useState(null);
    const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
    const [viewingTx, setViewingTx] = useState(null);

    // New State for Payments
    const [selectedTransactionForAdd, setSelectedTransactionForAdd] = useState(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);


    const bottomRef = useRef(null);

    // Fetch transactions
    useEffect(() => {
        if (!isOpen || !supplier) return;

        setLoading(true);
        const q = query(
            collection(db, `suppliers/${supplier.id}/transactions`),
            orderBy("createdAt", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const txs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            // Calculate running balance
            let runningBalance = 0;
            const txsWithBalance = txs.map(tx => {
                const isPayment = tx.type === 'payment';
                const amount = Number(tx.amount || 0);
                const paymentAmount = Number(tx.paymentAmount || 0);

                if (isPayment) {
                    runningBalance -= amount;
                } else {
                    runningBalance += amount;
                    if (paymentAmount > 0) {
                        runningBalance -= paymentAmount;
                    }
                }

                return { ...tx, currentBalance: runningBalance };
            });

            setTransactions(txsWithBalance);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isOpen, supplier, refreshTrigger]);

    // Calculate stats
    const stats = useMemo(() => {
        let totalPurchases = 0;
        let totalPayments = 0;

        transactions.forEach(tx => {
            const amount = Number(tx.amount || 0);
            const paymentAmount = Number(tx.paymentAmount || 0);

            if (tx.type === 'payment') {
                totalPayments += amount;
            } else {
                totalPurchases += amount;
                if (paymentAmount > 0) {
                    totalPayments += paymentAmount;
                }
            }
        });

        const netBalance = transactions.length > 0
            ? transactions[transactions.length - 1].currentBalance
            : 0;

        return { totalPurchases, totalPayments, netBalance };
    }, [transactions]);

    // Delete transaction
    const handleDelete = async (transaction) => {
        const typeLabel = transaction.type === 'payment' ? 'الدفعة' : 'الفاتورة';

        if (!await notify.confirm(`حذف ${typeLabel}`, `هل أنت متأكد من حذف هذ${transaction.type === 'payment' ? 'ه' : 'ه'} ${typeLabel}؟ لا يمكن التراجع عن هذا الإجراء.`)) {
            return;
        }

        try {
            await deleteDoc(doc(db, `suppliers/${supplier.id}/transactions`, transaction.id));
            notify.success(`تم حذف ${typeLabel} بنجاح`);
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            console.error("Error deleting transaction:", error);
            notify.error("حدث خطأ أثناء الحذف");
        }
    };

    if (!isOpen || !supplier) return null;

    return (
        <div className="fixed inset-0 z-[200] flex flex-col bg-slate-100 animate-fade-in">
            {/* Header */}
            <div className="bg-white p-4 shadow-sm z-20 flex justify-between items-center px-6 border-b border-slate-200 flex-shrink-0">
                <div>
                    <h3 className="font-black text-2xl text-slate-800 flex items-center gap-2">
                        <FileText className="text-blue-600" /> كشف حساب المورد
                    </h3>
                    <p className="text-sm text-slate-500 font-bold mt-1 opacity-80">{supplier.name}</p>
                </div>
                {/* Close & Direct Actions */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsCreateInvoiceOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm transition"
                    >
                        <Plus size={16} /> إضافة فاتورة
                    </button>
                    <button
                        onClick={() => setIsPaymentModalOpen(true)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm transition"
                    >
                        <Banknote size={16} /> تسجيل دفعة
                    </button>
                    <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition text-slate-500"><X size={24} /></button>
                </div>
            </div>

            {/* Stats Summary - Kept Same */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 max-w-6xl mx-auto w-full flex-shrink-0">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">إجمالي المشتريات (عليه)</span>
                    <span className="text-2xl font-bold text-red-600 dir-ltr">{formatPrice(stats.totalPurchases)}</span>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">إجمالي المدفوعات (له)</span>
                    <span className="text-2xl font-bold text-emerald-600 dir-ltr">{formatPrice(stats.totalPayments)}</span>
                </div>
                <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg flex flex-col justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">الرصيد الحالي (للمورد)</span>
                    <span className="text-3xl font-bold dir-ltr">{formatPrice(stats.netBalance)}</span>
                </div>
            </div>

            {/* Transaction Feed */}
            <div className="flex-1 overflow-auto px-4 pb-10">
                <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 min-h-[400px] flex flex-col">
                    <div>
                        <table className="w-full border-collapse border border-slate-300 text-sm text-right relative">
                            <thead className="text-white">
                                <tr>
                                    <th className="sticky top-0 z-20 bg-slate-900 border border-slate-300 px-4 py-3 font-bold whitespace-nowrap first:rounded-tr-2xl">التاريخ</th>
                                    <th className="sticky top-0 z-20 bg-slate-900 border border-slate-300 px-4 py-3 font-bold w-1/3">التفاصيل</th>
                                    <th className="sticky top-0 z-20 bg-slate-900 border border-slate-300 px-4 py-3 font-bold text-center whitespace-nowrap">مدين (عليه)</th>
                                    <th className="sticky top-0 z-20 bg-slate-900 border border-slate-300 px-4 py-3 font-bold text-center whitespace-nowrap">دائن (له)</th>
                                    <th className="sticky top-0 z-20 bg-slate-900 border border-slate-300 px-4 py-3 font-bold text-center whitespace-nowrap">الرصيد</th>
                                    <th className="sticky top-0 z-20 bg-slate-900 border border-slate-300 px-4 py-3 font-bold text-center whitespace-nowrap w-32 last:rounded-tl-2xl">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="p-10 text-center"><Loader2 className="animate-spin text-blue-500 mx-auto" /></td>
                                    </tr>
                                ) : transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="p-10 text-center text-slate-400 font-bold">
                                            <FileText size={48} className="mx-auto mb-2 opacity-50" />
                                            لا توجد سجلات
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.map((tx) => {
                                        const isPayment = tx.type === 'payment';
                                        const dateObj = tx.createdAt?.toDate ? tx.createdAt.toDate() : new Date();
                                        const amount = Number(tx.amount || 0);

                                        return (
                                            <tr
                                                key={tx.id}
                                                onClick={() => !isPayment && setViewingTx(tx)}
                                                className={`hover:bg-blue-50/50 transition-colors cursor-pointer group ${isPayment ? 'bg-emerald-50/10' : ''}`}
                                            >
                                                {/* Date */}
                                                <td className="border border-slate-300 px-4 py-3 text-slate-700 font-bold whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span>{dateObj.toLocaleDateString('en-GB')}</span>
                                                        <span className="text-[10px] text-slate-400 font-mono">{dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                </td>

                                                {/* Details */}
                                                <td className="border border-slate-300 px-4 py-3 text-slate-700 font-bold align-middle">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div className={`w-2 h-2 rounded-full shrink-0 ${isPayment ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                                        <span className={`${isPayment ? 'text-emerald-700' : 'text-red-700'}`}>
                                                            {isPayment ? 'دفعة مسددة' : (tx.grossWeight ? `فاتورة (${tx.grossWeight} كغ)` : 'فاتورة شراء')}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <p className="text-slate-500 text-xs truncate max-w-[200px]" title={tx.note}>{tx.note || '-'}</p>
                                                        {tx.imageUrl && (
                                                            <button onClick={(e) => { e.stopPropagation(); setPreviewImage(tx.imageUrl) }} className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1 rounded-md"><ImageIcon size={14} /></button>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Debit (Invoice) */}
                                                <td className="border border-slate-300 px-4 py-3 text-center align-middle">
                                                    {!isPayment ? (
                                                        <TransactionStatusBadge totalAmount={amount} paidAmount={Number(tx.paymentAmount) || 0} />
                                                    ) : <span className="text-slate-300">-</span>}
                                                </td>

                                                {/* Credit (Payment) */}
                                                <td className="border border-slate-300 px-4 py-3 text-center align-middle">
                                                    {isPayment ? (
                                                        <span className="text-emerald-600 font-bold dir-ltr block">{formatPrice(amount)}</span>
                                                    ) : (Number(tx.paymentAmount) > 0 ? (
                                                        <span className="text-emerald-600/70 text-xs font-bold block dir-ltr">
                                                            (جزء: {formatPrice(Number(tx.paymentAmount))})
                                                        </span>
                                                    ) : <span className="text-slate-300">-</span>)}
                                                </td>

                                                {/* Balance */}
                                                <td className="border border-slate-300 px-4 py-3 text-center align-middle">
                                                    <span className={`px-2 py-1 rounded text-sm font-bold dir-ltr inline-block min-w-[80px] ${tx.currentBalance > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                                        {formatPrice(tx.currentBalance)}
                                                    </span>
                                                </td>

                                                {/* Actions */}
                                                <td className="border border-slate-300 px-3 py-3 text-center align-middle">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {/* 1. WhatsApp */}
                                                        {supplier.phone && (
                                                            <a
                                                                href={`https://wa.me/${supplier.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                                                    `مرحباً ${supplier.name}، تفاصيل فاتورة بتاريخ ${dateObj.toLocaleDateString('ar-DZ')}:\nالمبلغ: ${amount.toLocaleString()} دج\nالمدفوع: ${(Number(tx.paymentAmount) || 0).toLocaleString()} دج\nالمتبقي: ${(amount - (Number(tx.paymentAmount) || 0)).toLocaleString()} دج.\nشكراً لتعاملك معنا!`
                                                                )}`}
                                                                target="_blank"
                                                                title="إرسال عبر واتساب"
                                                                className="p-2 rounded-full hover:bg-green-50 text-green-600 transition-colors"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <MessageCircle size={18} />
                                                            </a>
                                                        )}

                                                        {/* 2. Quick Pay (Only if Debt exists) */}
                                                        {!isPayment && (amount - (Number(tx.paymentAmount) || 0)) > 0 && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setSelectedTransactionForAdd(tx) }}
                                                                title="تسديد دفعة"
                                                                className="p-2 rounded-full hover:bg-blue-50 text-blue-600 transition-colors"
                                                            >
                                                                <Banknote size={18} />
                                                            </button>
                                                        )}

                                                        {/* 3. Edit */}
                                                        <Link
                                                            href={`/admin/suppliers/transactions/${tx.id}/edit`}
                                                            onClick={(e) => e.stopPropagation()}
                                                            title="تعديل الفاتورة"
                                                            className="p-2 rounded-full hover:bg-amber-50 text-amber-500 transition-colors"
                                                        >
                                                            <Edit2 size={18} />
                                                        </Link>

                                                        {/* 4. View */}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setViewingTx(tx) }}
                                                            title="معاينة"
                                                            className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                                                        >
                                                            <Eye size={18} />
                                                        </button>

                                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(tx) }} className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-full transition" title="حذف">
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>

                        {/* Auto Scroll Anchor */}
                        <div ref={bottomRef} className="h-4" />
                    </div>
                </div>
            </div>

            {/* Modals */}
            <EditSupplierTransactionModal
                isOpen={isCreateInvoiceOpen}
                onClose={() => setIsCreateInvoiceOpen(false)}
                transaction={null} // Pass null to indicate creation mode
                supplierId={supplier.id}
                onSuccess={() => setRefreshTrigger(p => p + 1)}
            />

            <EditSupplierTransactionModal
                isOpen={!!editingTx}
                onClose={() => setEditingTx(null)}
                transaction={editingTx}
                supplierId={supplier.id}
                onSuccess={() => setRefreshTrigger(p => p + 1)}
            />

            <TransactionDetailsModal
                isOpen={!!viewingTx}
                onClose={() => setViewingTx(null)}
                transaction={viewingTx}
                supplier={supplier}
            />

            <AddToTransactionModal
                isOpen={!!selectedTransactionForAdd}
                onClose={() => setSelectedTransactionForAdd(null)}
                supplier={supplier}
                transaction={selectedTransactionForAdd}
            />

            <SupplierPaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                supplier={supplier}
            />

            {/* Image Preview */}
            {previewImage && (
                <div className="fixed inset-0 z-[250] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in" onClick={() => setPreviewImage(null)}>
                    <img src={previewImage} alt="Full Preview" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
                    <button className="absolute top-4 right-4 text-white hover:text-red-500 transition"><X size={32} /></button>
                </div>
            )}
        </div>
    );
}
