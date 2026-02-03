"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { FileText, Wallet, Package, ArrowUpRight, ArrowDownLeft, Clock, Eye, ShoppingBag, Receipt, ChevronLeft } from "lucide-react";
import { notify } from "@/lib/notify";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import ClientOrderDetailsModal from "@/components/b2b/ClientOrderDetailsModal";
import SplashScreen from "@/components/SplashScreen";

import { useClientLedger } from "@/hooks/useClientLedger";

// Skeleton Component
function DashboardSkeleton() {
    return (
        <div className="space-y-6 p-4">
            <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-200 animate-pulse" />
                <div className="flex-1 space-y-2">
                    <div className="h-6 w-32 bg-slate-200 rounded animate-pulse" />
                    <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
                </div>
            </div>
            <div className="h-48 rounded-3xl bg-slate-200 animate-pulse" />
            <div className="h-14 rounded-2xl bg-slate-200 animate-pulse" />
            <div className="space-y-3">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
                ))}
            </div>
        </div>
    );
}

export default function B2BDashboard() {
    const { user } = useAuth();
    const router = useRouter();
    // Use Shared Hook for Single Source of Truth
    const { transactions, balance, loading } = useClientLedger(user);

    const [activeTab, setActiveTab] = useState('overview'); // overview, orders, statement
    const [selectedOrder, setSelectedOrder] = useState(null);

    const handleNewOrder = () => {
        router.push("/b2b");
    };
    // Removed duplicate fetch logic to prevent mismatches

    if (loading) return <DashboardSkeleton />;
    if (!user) return null;

    // Filter & Sort Logic
    // Statement: Ascending (Oldest -> Newest) as calculated
    // Overview/Orders: Descending (Newest -> Oldest)
    const filteredTransactions = activeTab === 'statement'
        ? transactions
        : [...transactions].reverse().filter(t => {
            if (activeTab === 'orders') return (t.source === 'order' || t.source === 'merged' || (t.notes && t.notes.includes('طلب')));
            return true; // Overview shows all (sliced below)
        });

    // Overview limit
    const displayTransactions = activeTab === 'overview' ? filteredTransactions.slice(0, 5) : filteredTransactions;

    return (
        <div className="min-h-screen bg-slate-50 pb-24 relative">
            {/* Header Section */}
            <div className="bg-white p-5 pt-8 rounded-b-[2.5rem] shadow-sm mb-6">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-slate-200">
                        {user.fullName?.[0]}
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800">{user.fullName}</h1>
                        <p className="text-slate-400 font-mono text-sm tracking-widest opacity-80">{user.phone}</p>
                    </div>
                    <button onClick={handleNewOrder} className="mr-auto bg-red-50 text-red-600 w-12 h-12 rounded-full flex items-center justify-center hover:bg-red-100 transition shadow-sm">
                        <Package size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-2xl">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        نظرة عامة
                    </button>
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${activeTab === 'orders' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        الطلبات
                    </button>
                    <button
                        onClick={() => setActiveTab('statement')}
                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all ${activeTab === 'statement' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        كشف الحساب
                    </button>
                </div>
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="px-4 space-y-6"
                >
                    {activeTab === 'overview' && (
                        <>
                            {/* Balance Card */}
                            <div className="relative overflow-hidden bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl shadow-slate-200">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-slate-800 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-4 opacity-80">
                                        <Wallet size={20} />
                                        <span className="text-sm font-bold uppercase tracking-widest">الرصيد المستحق</span>
                                    </div>
                                    <div className="flex items-baseline gap-2 mb-6">
                                        <h2 className="text-5xl font-black tracking-tight dir-ltr">{Number(balance || 0).toLocaleString()}</h2>
                                        <span className="text-xl font-bold opacity-60">DZD</span>
                                    </div>
                                    {user.isCreditAllowed && (
                                        <div className="flex items-center gap-2 text-[10px] font-bold opacity-60 bg-white/10 w-fit px-3 py-1.5 rounded-full backdrop-blur-sm">
                                            <span>الحد المسموح:</span>
                                            <span>{Number(user.creditLimit || 0).toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Quick Actions Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={handleNewOrder} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center gap-3 hover:border-red-100 transition group">
                                    <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 group-hover:scale-110 transition">
                                        <ShoppingBag size={28} />
                                    </div>
                                    <span className="font-bold text-slate-700 text-sm">طلب جديد</span>
                                </button>
                                <button onClick={() => setActiveTab('statement')} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center gap-3 hover:border-blue-100 transition group">
                                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition">
                                        <Receipt size={28} />
                                    </div>
                                    <span className="font-bold text-slate-700 text-sm">كشف مفصل</span>
                                </button>
                            </div>
                        </>
                    )}

                    {/* Section Header */}
                    <div className="flex items-center justify-between px-2">
                        <h3 className="font-black text-lg text-slate-800 flex items-center gap-2">
                            {activeTab === 'overview' ? <Clock size={20} className="text-slate-400" /> :
                                activeTab === 'orders' ? <ShoppingBag size={20} className="text-slate-400" /> :
                                    <Receipt size={20} className="text-slate-400" />}
                            {activeTab === 'overview' ? 'أحدث العمليات' :
                                activeTab === 'orders' ? 'سجل الطلبات' : 'كشف الحساب'}
                        </h3>
                    </div>

                    {/* Transactions List OR Table */}
                    <div className="pb-8">
                        {displayTransactions.length === 0 ? (
                            <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-400 font-bold">
                                لا توجد بيانات
                            </div>
                        ) : activeTab === 'statement' ? (
                            <div className="bg-white border border-slate-100 rounded-[1.5rem] shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-right text-sm">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr className="text-slate-500 font-bold text-xs whitespace-nowrap">
                                                <th className="px-4 py-4 text-start">التاريخ</th>
                                                <th className="px-4 py-4 text-center text-blue-600">مشتريات</th>
                                                <th className="px-4 py-4 text-center text-green-600">مدفوعات</th>
                                                <th className="px-4 py-4 text-center text-red-600 text-lg">الرصيد</th>
                                                <th className="px-4 py-4 text-center">التفاصيل</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {displayTransactions.map((tx, idx) => {
                                                const isPayment = tx.type === 'PAYMENT_RECEIVED';
                                                const dateObj = tx.createdAt?.toDate ? tx.createdAt.toDate() : (tx.created_at?.toDate ? tx.created_at.toDate() : new Date());
                                                const amount = Number(tx.amount || 0);
                                                const hasDetails = (tx.source === 'order' || tx.source === 'merged' || tx.imageUrl);

                                                return (
                                                    <tr key={idx} className="hover:bg-slate-50 transition text-xs font-bold text-slate-700">
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <div className="flex flex-col">
                                                                <span className="text-slate-900">{dateObj.toLocaleDateString('ar-DZ', { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' })}</span>
                                                                <span className="text-[10px] text-slate-400 dir-ltr text-right">{dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center whitespace-nowrap text-blue-700 bg-blue-50/20">
                                                            {!isPayment ? amount.toLocaleString() : '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-center whitespace-nowrap text-green-700 bg-green-50/20">
                                                            {isPayment ? amount.toLocaleString() : (tx._totalPaidInternal > 0 ? tx._totalPaidInternal.toLocaleString() : '-')}
                                                        </td>
                                                        <td className="px-4 py-3 text-center whitespace-nowrap font-black text-red-600 text-sm bg-red-50/20 dir-ltr">
                                                            {tx.currentBalance?.toLocaleString()}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <button
                                                                onClick={() => setSelectedOrder(tx)}
                                                                className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:bg-blue-600 hover:text-white flex items-center justify-center transition"
                                                            >
                                                                <Eye size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            // Card View for Overview & Orders
                            <div className="space-y-3">
                                {displayTransactions.map((tx, idx) => {
                                    const isPayment = tx.type === 'PAYMENT_RECEIVED';
                                    const dateObj = tx.createdAt?.toDate ? tx.createdAt.toDate() : (tx.created_at?.toDate ? tx.created_at.toDate() : new Date());
                                    const amount = Number(tx.amount || 0);
                                    const hasDetails = (tx.source === 'order' || tx.source === 'merged' || tx.imageUrl);

                                    return (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            key={idx}
                                            className="bg-white p-4 rounded-[1.25rem] shadow-sm border border-slate-100 flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 ${isPayment ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-600'}`}>
                                                    {isPayment ? <ArrowDownLeft size={22} /> :
                                                        tx.imageUrl ? <Receipt size={22} /> : <ArrowUpRight size={22} />}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 text-sm mb-1">
                                                        {dateObj.toLocaleDateString('ar-DZ', { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' })}
                                                    </h4>
                                                    <p className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-md w-fit">
                                                        {tx.notes || (isPayment ? 'دفعة نقدية' : 'فاتورة / طلب')}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <div className="text-left">
                                                    <span className={`block font-black text-base dir-ltr ${isPayment ? 'text-green-600' : 'text-slate-800'}`}>
                                                        {isPayment ? '-' : '+'}{amount.toLocaleString()}
                                                    </span>
                                                    {!isPayment && tx._totalPaidInternal > 0 && (
                                                        <span className="text-[10px] text-green-600 font-bold block bg-green-50 px-1.5 py-0.5 rounded mt-1">
                                                            مدفوع: {tx._totalPaidInternal.toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                                {hasDetails && (
                                                    <button
                                                        onClick={() => setSelectedOrder(tx)}
                                                        className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition shadow-sm"
                                                    >
                                                        <Eye size={20} />
                                                    </button>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </motion.div>
            </AnimatePresence>

            <ClientOrderDetailsModal
                isOpen={!!selectedOrder}
                onClose={() => setSelectedOrder(null)}
                order={selectedOrder}
            />
        </div>
    );
}
