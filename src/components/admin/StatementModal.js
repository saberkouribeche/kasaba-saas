
"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { X, FileText, Loader2, Eye, Edit2, Trash2, ArrowUpRight, ArrowDownLeft, Wallet, Image as ImageIcon, MessageCircle, Printer } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc as firestoreDoc, deleteDoc } from "firebase/firestore";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import OrderDetailsModal from "./OrderDetailsModal";
import EditB2BTransactionModal from "./EditB2BTransactionModal";
import { recalculateCustomerBalance } from "@/lib/balanceCalculator";
import { notify } from "@/lib/notify";
import ManageRestaurantProductsModal from "./ManageRestaurantProductsModal";
import AddInvoiceModal from "./AddInvoiceModal";
import PaymentModal from "./PaymentModal";
import InvoicePaymentsModal from "./InvoicePaymentsModal";
import { Plus, Package } from "lucide-react";
import TransactionStatusBadge from "@/components/ui/TransactionStatusBadge";

export default function StatementModal({ isOpen, onClose, client }) {
    useLockBodyScroll(isOpen);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);
    const [paymentModal, setPaymentModal] = useState(null);
    const [invoicePaymentsModal, setInvoicePaymentsModal] = useState(null);
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const bottomRef = useRef(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (transactions.length > 0) {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [transactions, isOpen]);

    useEffect(() => {
        if (!isOpen || !client) return;

        const fetchStatement = async () => {
            setLoading(true);
            try {
                // 1. Fetch Transactions
                const qTx = query(
                    collection(db, "transactions"),
                    where("userId", "==", client.id)
                );

                // 2. Fetch Orders
                let qOrders;
                if (client.phone) {
                    qOrders = query(
                        collection(db, "order"),
                        where("customer_phone", "==", client.phone)
                    );
                } else {
                    qOrders = query(collection(db, "order"), where("customer_phone", "==", "NON_EXISTENT"));
                }

                const [snapTx, snapOrders] = await Promise.all([getDocs(qTx), getDocs(qOrders)]);

                // 3. Process & Merge
                const txs = snapTx.docs.map(d => ({ id: d.id, ...d.data(), source: 'tx' }));
                const orders = snapOrders.docs.map(d => ({
                    id: d.id,
                    type: "ORDER_PLACED",
                    amount: Number(d.data().order_total),
                    created_at: d.data().created_at,
                    notes: `Bon de vente N°${d.data().order_number}`,
                    source: 'order',
                    ...d.data()
                }));

                // Map of OrderID -> OrderDetails (for fast lookup)
                const orderMap = new Map();
                orders.forEach(o => orderMap.set(o.id.toString(), o));
                orders.forEach(o => orderMap.set(o.order_number?.toString(), o));

                // Enhance Transactions
                const enhancedTxs = txs.map(tx => {
                    if (tx.orderId && orderMap.has(tx.orderId)) {
                        return { ...orderMap.get(tx.orderId), ...tx, source: 'merged' };
                    }
                    return tx;
                });

                const txOrderIds = new Set(enhancedTxs.filter(t => t.orderId).map(t => t.orderId));
                const uniqueOrders = orders.filter(o => !txOrderIds.has(o.id));
                const allEvents = [...enhancedTxs, ...uniqueOrders];

                // Sort Chronologically for Calculation
                // Sort Chronologically for Calculation
                allEvents.sort((a, b) => {
                    // Handle Firestore Timestamps (createdAt or created_at)
                    // If null (pending write), assume it's NEW (now), so it goes to the bottom.
                    const getDate = (item) => {
                        if (item.createdAt) return item.createdAt.toDate ? item.createdAt.toDate() : new Date();
                        if (item.created_at) return item.created_at.toDate ? item.created_at.toDate() : new Date();
                        return new Date(0); // Only if absolutely no date field exists
                    };

                    const dateA = getDate(a);
                    const dateB = getDate(b);
                    return dateA - dateB;
                });

                // Calculate Running Balance
                let runningBalance = 0;
                const eventsWithBalance = allEvents.map(tx => {
                    const isPayment = tx.type === 'PAYMENT_RECEIVED';
                    const amount = Number(tx.amount || 0);
                    // Use total_paid if available (updated by subsequent payments), otherwise fallback to initial paymentAmount.
                    const paymentAmount = Math.max(Number(tx.total_paid || 0), Number(tx.paymentAmount || 0));

                    if (isPayment) {
                        runningBalance -= amount;
                    } else {
                        runningBalance += amount;
                        if (paymentAmount > 0) {
                            runningBalance -= paymentAmount;
                        }
                    }
                    return { ...tx, currentBalance: runningBalance, _totalPaidInternal: paymentAmount };
                });

                setTransactions(eventsWithBalance);

            } catch (error) {
                console.error("Statement Error:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStatement();
    }, [isOpen, client, refreshTrigger]);

    const stats = useMemo(() => {
        let totalPurchases = 0;
        let totalPayments = 0;

        transactions.forEach(t => {
            const amount = Number(t.amount || 0);
            const paymentAmount = Number(t._totalPaidInternal || 0);

            if (t.type === 'PAYMENT_RECEIVED') {
                totalPayments += amount;
            } else {
                totalPurchases += amount;
                if (paymentAmount > 0) {
                    totalPayments += paymentAmount;
                }
            }
        });

        const netBalance = transactions.length > 0 ? transactions[transactions.length - 1].currentBalance : 0;

        return { totalPurchases, totalPayments, netBalance };
    }, [transactions]);

    const handleDelete = async (transaction) => {
        const typeLabel = transaction.source === 'order' || transaction.source === 'merged' ? 'الطلب' : 'المعاملة';
        if (!await notify.confirm(`حذف ${typeLabel}`, `هل أنت متأكد من حذف هذا ${typeLabel}؟ لا يمكن التراجع عن هذا الإجراء.`)) return;

        try {
            if (transaction.source === 'merged') {
                await deleteDoc(firestoreDoc(db, "transactions", transaction.id));
                if (transaction.orderId) await deleteDoc(firestoreDoc(db, "order", transaction.orderId));
            } else if (transaction.source === 'order') {
                await deleteDoc(firestoreDoc(db, "order", transaction.id));
            } else {
                await deleteDoc(firestoreDoc(db, "transactions", transaction.id));
            }

            await recalculateCustomerBalance(client.id);
            notify.success(`تم حذف ${typeLabel} بنجاح`);

            // Re-fetch logic
            setRefreshTrigger(prev => prev + 1);

        } catch (error) {
            console.error("Error deleting item:", error);
            notify.error("حدث خطأ أثناء الحذف");
        }
    };

    if (!isOpen || !client) return null;

    // Display List (Oldest First)
    const displayTransactions = transactions;

    return (
        <div className="fixed inset-0 z-[200] flex flex-col bg-slate-100 animate-fade-in">
            {/* Header */}
            <div className="bg-white p-4 shadow-sm z-20 flex justify-between items-center px-6">
                <div>
                    <h3 className="font-black text-2xl text-slate-800 flex items-center gap-2">
                        <FileText className="text-blue-600" /> كشف حساب مفصل
                    </h3>
                    <p className="text-sm text-slate-500 font-bold mt-1 opacity-80">{client.fullName}</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsProductModalOpen(true)}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm transition"
                    >
                        <Package size={16} /> المنتجات
                    </button>
                    <button
                        onClick={() => setIsInvoiceModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm transition"
                    >
                        <Plus size={16} /> إضافة فاتورة
                    </button>
                    <button
                        onClick={() => setPaymentModal({ notes: 'دفعة حساب', amount: '' })}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm transition"
                    >
                        <Wallet size={16} /> تسجيل دفعة
                    </button>
                    <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition text-slate-500"><X size={24} /></button>
                </div>
            </div>

            {/* Stats Summary Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 max-w-6xl mx-auto w-full">
                <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-2xl border border-blue-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-24 h-24 bg-blue-100/50 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                    <div>
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div> مجموع المشتريات
                        </span>
                        <span className="text-3xl font-black text-slate-800 tracking-tight">
                            {stats.totalPurchases.toLocaleString()} <span className="text-sm text-slate-400 font-bold">دج</span>
                        </span>
                    </div>
                    <ArrowDownLeft className="text-blue-500 absolute bottom-6 right-6 opacity-20 group-hover:opacity-100 transition-opacity" size={48} />
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-white p-6 rounded-2xl border border-emerald-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-100/50 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                    <div>
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div> مجموع المدفوعات
                        </span>
                        <span className="text-3xl font-black text-slate-800 tracking-tight">
                            {stats.totalPayments.toLocaleString()} <span className="text-sm text-slate-400 font-bold">دج</span>
                        </span>
                    </div>
                    <ArrowUpRight className="text-emerald-500 absolute bottom-6 right-6 opacity-20 group-hover:opacity-100 transition-opacity" size={48} />
                </div>

                <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl shadow-slate-900/20 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                    <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                            <Wallet size={14} className="text-yellow-500" /> الرصيد الحالي
                        </span>
                        <span className="text-4xl font-black tracking-tight flex items-baseline gap-1">
                            {stats.netBalance.toLocaleString()} <span className="text-lg opacity-50">دج</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* Quick Actions (Moved to Header) - kept commented if needed later or remove */}
            {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 max-w-6xl mx-auto w-full mb-8">...</div> */}

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 pb-20">
                <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200">
                    {loading ? (
                        <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-blue-600" /></div>
                    ) : transactions.length === 0 ? (
                        <div className="text-center py-20 flex flex-col items-center justify-center opacity-50">
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                                <FileText size={40} />
                            </div>
                            <span className="font-bold text-xl text-slate-800">لا توجد عمليات مسجلة</span>
                            <span className="text-sm text-slate-500 mt-1">سجل أول عملية باستخدام الأزرار أعلاه</span>
                        </div>
                    ) : (
                        <>
                            {/* Mobile Card View (md:hidden) */}
                            <div className="md:hidden divide-y divide-gray-100 block">
                                <div className="p-4 bg-slate-50 border-b border-slate-100 text-center text-xs font-bold text-slate-500 uppercase">
                                    سجل العمليات
                                </div>
                                {displayTransactions.map((tx, idx) => {
                                    const isPayment = tx.type === 'PAYMENT_RECEIVED';
                                    const dateObj = tx.createdAt?.toDate ? tx.createdAt.toDate() : (tx.created_at?.toDate ? tx.created_at.toDate() : new Date());
                                    const amount = Number(tx.amount || 0);

                                    return (
                                        <div key={idx} className={`p-4 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${isPayment ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
                                                        <span className="font-black text-slate-800 text-sm">
                                                            {isPayment ? "تسديد دفعة" : (tx.order_number ? `#${tx.order_number}` : "فاتورة يدوية")}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-slate-500 font-mono">
                                                        {dateObj.toLocaleDateString('en-GB')} - {dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <div className="text-left">
                                                    <span className={`block font-black text-lg dir-ltr tabular-nums ${isPayment ? 'text-emerald-600' : 'text-slate-800'}`}>
                                                        {amount.toLocaleString()} <span className="text-xs opacity-50">دج</span>
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 block font-bold">
                                                        {isPayment ? "له" : "عليه"}
                                                    </span>
                                                </div>
                                            </div>

                                            {tx.notes && (
                                                <div className="bg-slate-50 p-2 rounded-lg text-xs text-slate-600 mb-3 border border-slate-100">
                                                    {tx.notes}
                                                </div>
                                            )}

                                            {/* Advanced Details for Invoice (Partial Payment) */}
                                            {!isPayment && tx.total_paid > 0 && (
                                                <div className="flex items-center justify-between mb-3 text-xs bg-amber-50 p-2 rounded-lg text-amber-800">
                                                    <span>مدفوع:</span>
                                                    <span className="font-mono font-bold">{tx.total_paid.toLocaleString()} دج</span>
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                                <div>
                                                    <span className="text-[10px] text-slate-400 font-bold block mb-1">الرصيد بعد العملية</span>
                                                    <span className={`font-black text-sm dir-ltr tabular-nums px-2 py-1 rounded-lg ${tx.currentBalance > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                                        {tx.currentBalance.toLocaleString()} دج
                                                    </span>
                                                </div>
                                                <div className="flex gap-2">
                                                    {(!isPayment && !tx.order_number) && (
                                                        <button
                                                            onClick={() => {
                                                                const printUrl = `/admin/print/transaction/${tx.id}?type=general&userId=${client.id}`;
                                                                const width = 800;
                                                                const height = window.screen.height;
                                                                const left = (window.screen.width - width) / 2;
                                                                const top = 0;
                                                                window.open(printUrl, 'print_popup', `width=${width},height=${height},left=${left},top=${top}`);
                                                            }}
                                                            className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:text-blue-600"
                                                            title="طباعة"
                                                        >
                                                            <Printer size={16} />
                                                        </button>
                                                    )}
                                                    {!isPayment && (
                                                        <button onClick={() => setSelectedOrder(tx.source === 'merged' ? { ...tx, id: tx.orderId } : { ...tx, customer_name: client.fullName || client.name, customer_phone: client.phone })} className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Eye size={16} /></button>
                                                    )}
                                                    {tx.source === 'tx' && (
                                                        <button onClick={() => setEditingTransaction(tx)} className="p-2 bg-slate-50 text-slate-600 rounded-lg"><Edit2 size={16} /></button>
                                                    )}
                                                    <button onClick={() => handleDelete(tx)} className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash2 size={16} /></button>
                                                    {!isPayment && (
                                                        <button onClick={() => setPaymentModal(tx)} className="p-2 bg-green-50 text-green-600 rounded-lg font-bold text-xs flex items-center gap-1">
                                                            <Wallet size={16} /> تسديد
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={bottomRef} />
                            </div>

                            {/* Desktop Table (hidden md:table) */}
                            <table className="w-full text-sm text-right border-collapse hidden md:table">
                                <thead className="bg-slate-900 text-slate-300 sticky top-0 z-10 shadow-md rounded-t-2xl">
                                    <tr>
                                        <th className="p-4 font-bold whitespace-nowrap text-xs uppercase tracking-wider border-l border-slate-700/50 rounded-tr-2xl">التاريخ</th>
                                        <th className="p-4 font-bold whitespace-nowrap w-20 text-center text-xs uppercase tracking-wider border-l border-slate-700/50">المرفق</th>
                                        <th className="p-4 font-bold whitespace-nowrap text-xs uppercase tracking-wider border-l border-slate-700/50">البيان / التفاصيل</th>
                                        <th className="p-4 font-bold whitespace-nowrap text-xs uppercase tracking-wider border-l border-slate-700/50">المشتريات (عليه)</th>
                                        <th className="p-4 font-bold whitespace-nowrap text-xs uppercase tracking-wider border-l border-slate-700/50">المدفوعات (له)</th>
                                        <th className="p-4 font-bold whitespace-nowrap text-xs uppercase tracking-wider text-white border-l border-slate-700/50">الرصيد</th>
                                        <th className="p-4 font-bold whitespace-nowrap text-center text-xs uppercase tracking-wider rounded-tl-2xl">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {displayTransactions.map((tx, idx) => {
                                        const isPayment = tx.type === 'PAYMENT_RECEIVED';
                                        const dateObj = tx.createdAt?.toDate ? tx.createdAt.toDate() : (tx.created_at?.toDate ? tx.created_at.toDate() : new Date());
                                        const amount = Number(tx.amount || 0);

                                        return (
                                            <tr key={idx} className={`group transition-all hover:bg-blue-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                                                <td className="p-4 whitespace-nowrap align-top border-l border-slate-100">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[10px] w-fit">
                                                            {dateObj.toLocaleDateString('ar-DZ', { weekday: 'long' })}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-slate-800 text-sm font-mono">{dateObj.toLocaleDateString('en-GB')}</span>
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 font-mono">{dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center align-top border-l border-slate-100">
                                                    {tx.imageUrl ? (
                                                        <button onClick={() => setPreviewImage(tx.imageUrl)} className="w-12 h-12 rounded-xl overflow-hidden border-2 border-slate-100 ring-2 ring-transparent hover:ring-blue-500 transition relative group/img shadow-sm">
                                                            <img src={tx.imageUrl} alt="img" className="w-full h-full object-cover" />
                                                            <div className="absolute inset-0 bg-black/10 group-hover/img:bg-black/0 transition" />
                                                        </button>
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center mx-auto text-slate-300 font-mono text-xs">
                                                            -
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4 align-top border-l border-slate-100">
                                                    <div className="flex flex-col max-w-[280px] gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full ${isPayment ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
                                                            <span className="font-black text-slate-800 truncate text-base" title={tx.notes}>
                                                                {isPayment ? "تسديد دفعة مالية" : (tx.order_number ? `طلب #${tx.order_number}` : "فاتورة يدوية")}
                                                            </span>
                                                        </div>
                                                        <span className="text-xs text-slate-500 leading-relaxed pr-4 line-clamp-2">{tx.notes || "لا توجد تفاصيل إضافية"}</span>
                                                        {tx.source === 'merged' && <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full w-fit mt-1 border border-blue-100 font-bold">مرتبط بالنظام</span>}
                                                    </div>
                                                </td>
                                                <td className="p-4 align-top border-l border-slate-100">
                                                    {!isPayment ? (
                                                        <TransactionStatusBadge totalAmount={amount} paidAmount={Number(tx._totalPaidInternal) || 0} />
                                                    ) : <span className="text-slate-200 font-bold">-</span>}
                                                </td>
                                                <td className="p-4 align-top border-l border-slate-100">
                                                    {isPayment ? (
                                                        <span className="font-black text-emerald-600 text-lg dir-ltr block tabular-nums">
                                                            {amount.toLocaleString()} <span className="text-xs font-bold opacity-50">دج</span>
                                                        </span>
                                                    ) : (tx._totalPaidInternal > 0 ? (
                                                        <button
                                                            onClick={() => setInvoicePaymentsModal(tx)}
                                                            className="flex flex-col items-center hover:bg-slate-100 p-2 rounded-xl transition group/pay"
                                                        >
                                                            <span className="font-black text-emerald-600 text-lg dir-ltr block tabular-nums group-hover/pay:underline underline-offset-4 decoration-emerald-300">
                                                                {tx._totalPaidInternal.toLocaleString()} <span className="text-xs font-bold opacity-50">دج</span>
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 font-bold opacity-0 group-hover/pay:opacity-100 transition-opacity">تعديل</span>
                                                        </button>
                                                    ) : <span className="text-slate-200 font-bold">-</span>)}
                                                </td>
                                                <td className="p-4 align-top border-l border-slate-100">
                                                    <span className={`font-black text-lg dir-ltr block tabular-nums px-3 py-1 rounded-lg w-fit ${tx.currentBalance > 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                                        {tx.currentBalance.toLocaleString()} <span className="text-xs font-bold opacity-50">دج</span>
                                                    </span>
                                                </td>
                                                <td className="p-4 align-top">
                                                    <div className="flex items-center justify-center gap-2 bg-white p-1 rounded-xl shadow-sm md:bg-transparent md:shadow-none border md:border-none">
                                                        {((!isPayment && !tx.order_number) || isPayment) && (
                                                            <button
                                                                onClick={() => {
                                                                    const printUrl = `/admin/print/transaction/${tx.id}?type=general&userId=${client.id}`;
                                                                    const width = 800;
                                                                    const height = window.screen.height;
                                                                    const left = (window.screen.width - width) / 2;
                                                                    const top = 0;
                                                                    window.open(printUrl, 'print_popup', `width=${width},height=${height},left=${left},top=${top}`);
                                                                }}
                                                                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-blue-600 rounded-lg transition"
                                                                title="طباعة إيصال"
                                                            >
                                                                <Printer size={18} />
                                                            </button>
                                                        )}
                                                        {client.phone && (
                                                            <a
                                                                href={`https://wa.me/${(() => {
                                                                    const clean = client.phone.replace(/\D/g, '');
                                                                    if (clean.startsWith('0')) return '213' + clean.slice(1);
                                                                    if (clean.startsWith('213')) return clean;
                                                                    return '213' + clean;
                                                                })()}?text=${(() => {
                                                                    // 1. Header
                                                                    let msg = `*مرحباً ${client.fullName || client.name || 'عزيزي'} 👋، تفاصيل فاتورة بتاريخ ${dateObj.toLocaleDateString('en-GB')}*\n\n`;

                                                                    // 2. The Items Loop
                                                                    msg += `🛒 *السلع:*\n`;
                                                                    const items = tx.order_items && tx.order_items.length > 0 ? tx.order_items : (tx.items && tx.items.length > 0 ? tx.items : []);

                                                                    if (items.length > 0) {
                                                                        items.forEach(item => {
                                                                            const qty = Number(item.quantity || 0);
                                                                            const product = item.title || item.name || 'منتج';
                                                                            const price = Number(item.price || 0);
                                                                            msg += `• ${qty} وحدة x ${product} (${price.toLocaleString()} دج)\n`;
                                                                        });
                                                                    } else if (tx.notes) {
                                                                        msg += `📝 ${tx.notes}\n`;
                                                                    } else {
                                                                        msg += `(تفاصيل السلع غير متوفرة)\n`;
                                                                    }

                                                                    // 3. The Financials
                                                                    const paid = Math.max(Number(tx.paymentAmount || 0), Number(tx.total_paid || 0));
                                                                    const remaining = amount - paid;

                                                                    msg += `\n------------------\n`;
                                                                    msg += `💰 *المجموع:* ${amount.toLocaleString()} دج`;
                                                                    if (paid > 0) {
                                                                        msg += `\n✅ *مدفوع:* ${paid.toLocaleString()} دج`;
                                                                    }
                                                                    msg += `\n🔴 *المتبقي:* ${remaining.toLocaleString()} دج`;

                                                                    // 4. Footer
                                                                    msg += `\n\nشكراً لثقتكم بنا 🐔`;

                                                                    return encodeURIComponent(msg);
                                                                })()}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="p-2 hover:bg-green-50 text-slate-400 hover:text-green-600 rounded-lg transition"
                                                                title="إرسال عبر واتساب"
                                                            >
                                                                <MessageCircle size={18} />
                                                            </a>
                                                        )}
                                                        {!isPayment && (
                                                            <button onClick={() => setSelectedOrder(tx.source === 'merged' ? { ...tx, id: tx.orderId } : { ...tx, customer_name: client.fullName || client.name, customer_phone: client.phone })} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-blue-600 rounded-lg transition" title="عرض التفاصيل"><Eye size={18} /></button>
                                                        )}
                                                        {tx.source === 'tx' && (
                                                            <button onClick={() => setEditingTransaction(tx)} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-amber-600 rounded-lg transition" title="تعديل"><Edit2 size={18} /></button>
                                                        )}
                                                        <button onClick={() => handleDelete(tx)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition" title="حذف"><Trash2 size={18} /></button>
                                                        {!isPayment && (
                                                            <button onClick={() => setPaymentModal(tx)} className="p-2 hover:bg-green-50 text-slate-400 hover:text-green-600 rounded-lg transition" title="تسديد"><Wallet size={18} /></button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    <tr ref={bottomRef} />
                                </tbody>
                            </table>
                        </>
                    )}
                </div>
            </div>

            {/* Image Preview Modal */}
            {previewImage && (
                <div className="fixed inset-0 z-[250] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in" onClick={() => setPreviewImage(null)}>
                    <img src={previewImage} alt="Full Preview" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
                    <button className="absolute top-4 right-4 text-white hover:text-red-500 transition"><X size={32} /></button>
                </div>
            )}

            <OrderDetailsModal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} order={selectedOrder} />
            <EditB2BTransactionModal isOpen={!!editingTransaction} onClose={() => setEditingTransaction(null)} transaction={editingTransaction} client={client} onSuccess={() => setRefreshTrigger(prev => prev + 1)} />
            <PaymentModal isOpen={!!paymentModal} onClose={() => setPaymentModal(null)} invoice={paymentModal} client={client} onSuccess={() => setRefreshTrigger(prev => prev + 1)} />
            <InvoicePaymentsModal isOpen={!!invoicePaymentsModal} onClose={() => setInvoicePaymentsModal(null)} invoice={invoicePaymentsModal} client={client} onSuccess={() => setRefreshTrigger(prev => prev + 1)} />
            <AddInvoiceModal isOpen={isInvoiceModalOpen} onClose={() => setIsInvoiceModalOpen(false)} client={client} onSuccess={() => setRefreshTrigger(prev => prev + 1)} />
            {isProductModalOpen && (
                <ManageRestaurantProductsModal
                    isOpen={isProductModalOpen}
                    onClose={() => setIsProductModalOpen(false)}
                    client={client}
                />
            )}

        </div>
    );
}
