"use client";
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, where, limit } from "firebase/firestore";
import { Wallet, TrendingUp, AlertTriangle, ShoppingBag, ArrowUpRight, ArrowDownRight, Users, CreditCard, DollarSign } from "lucide-react";
import Link from "next/link";
import { useAdminData } from "@/context/AdminDataContext";

import AnalyticsDashboard from "@/components/admin/AnalyticsDashboard";
import SalesChart from "@/components/dashboard/SalesChart";

export default function AdminDashboard() {
    const { orders: allOrders, products, restaurants, suppliers, loading } = useAdminData(); // Use Context

    // Optimized: Calculate stats with useMemo to avoid extra render cycle
    const stats = useMemo(() => {
        if (loading) return {
            receivables: 0,
            payables: 0,
            topDebtors: [],
            recentOrders: []
        };

        // Sort Debtors
        const debtors = restaurants.filter(u => Number(u.totalDebt) > 0)
            .sort((a, b) => Number(b.totalDebt) - Number(a.totalDebt));

        const totalDebt = debtors.reduce((acc, curr) => acc + (Number(curr.totalDebt) || 0), 0);
        const totalPayables = suppliers.reduce((acc, curr) => acc + (Number(curr.debt) || 0), 0);

        return {
            receivables: totalDebt,
            payables: totalPayables,
            topDebtors: debtors.slice(0, 5),
            recentOrders: allOrders.slice(0, 5) // Context still provides recent orders for the list
        };
    }, [allOrders, restaurants, suppliers, loading]);

    const { recentOrders, topDebtors } = stats;

    if (loading) return <div className="flex h-screen items-center justify-center text-slate-400">تحميل لوحة القيادة...</div>;

    return (
        <div className="space-y-8 animate-fade-up">

            {/* 1. New Analytics Dashboard (Self-Referential Data) */}
            <AnalyticsDashboard />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Payables / Receivables */}
                <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-soft flex flex-col md:flex-row gap-4 md:col-span-2">
                    <div className="flex-1 flex justify-between items-center bg-orange-50 p-4 rounded-2xl border border-orange-100">
                        <div>
                            <p className="text-orange-600 font-bold text-xs uppercase">ديون الموردين</p>
                            <p className="text-xl font-black text-orange-900 mt-1">{stats.payables.toLocaleString()} دج</p>
                        </div>
                        <div className="bg-white p-2 rounded-full text-orange-500"><AlertTriangle size={20} /></div>
                    </div>
                    <div className="flex-1 flex justify-between items-center bg-blue-50 p-4 rounded-2xl border border-blue-100">
                        <div>
                            <p className="text-blue-600 font-bold text-xs uppercase">ديون الزبائن</p>
                            <p className="text-xl font-black text-blue-900 mt-1">{stats.receivables.toLocaleString()} دج</p>
                        </div>
                        <div className="bg-white p-2 rounded-full text-blue-500"><Users size={20} /></div>
                    </div>
                </div>

                {/* Sales Analytics */}
                <SalesChart />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 4. Recent Orders */}
                <div className="lg:col-span-2 bg-white rounded-[32px] border border-gray-100 shadow-soft overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-bold text-lg text-slate-800">أحدث الطلبات</h3>
                        <Link href="/admin/orders" className="text-sm font-bold text-red-600 hover:text-red-700">عرض الكل</Link>
                    </div>
                    {/* Mobile Card View (Visible only on mobile) */}
                    <div className="md:hidden divide-y divide-gray-50">
                        {recentOrders.map(order => (
                            <Link href={`/admin/orders`} key={order.id} className="block p-4 active:bg-slate-50">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="font-black text-slate-800 text-sm">#{order.order_number}</p>
                                        <p className="text-xs text-slate-500 font-bold mt-1">{order.customer_name}</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${order.order_status === 'delivered' ? 'bg-green-100 text-green-700' :
                                        order.order_status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                        {order.order_status === 'pending' ? 'انتظار' : order.order_status === 'delivered' ? 'مكتمل' : order.order_status}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-bold text-slate-400">{order.formattedDate}</span>
                                    <span className="font-black text-slate-800">{order.order_total?.toLocaleString()} دج</span>
                                </div>
                            </Link>
                        ))}
                    </div>

                    {/* Desktop Table (Hidden on mobile) */}
                    <table className="w-full text-right text-sm hidden md:table">
                        <tbody className="divide-y divide-gray-50">
                            {recentOrders.map(order => (
                                <tr key={order.id} className="hover:bg-slate-50 transition">
                                    <td className="px-6 py-4 font-bold text-slate-700">#{order.order_number}</td>
                                    <td className="px-6 py-4">{order.customer_name}</td>
                                    <td className="px-6 py-4 font-bold">{order.order_total?.toLocaleString()} دج</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${order.order_status === 'delivered' ? 'bg-green-100 text-green-700' :
                                            order.order_status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {order.order_status === 'pending' ? 'انتظار' : order.order_status === 'delivered' ? 'مكتمل' : order.order_status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* 5. Top Debtors */}
                <div className="bg-white rounded-[32px] border border-gray-100 shadow-soft overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h3 className="font-bold text-lg text-slate-800">أعلى الديون (B2B)</h3>
                    </div>
                    <div className="p-4 space-y-3">
                        {topDebtors.length === 0 ? <p className="text-center text-gray-400 py-4">لا توجد ديون</p> : topDebtors.map(debtor => (
                            <div key={debtor.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold text-slate-700 shadow-sm">
                                        {(debtor.fullName || debtor.name || "?")[0]}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{debtor.fullName || debtor.name || "مجهول"}</p>
                                        <p className="text-xs text-slate-400">{debtor.phone}</p>
                                    </div>
                                </div>
                                <span className="font-black text-red-600">{Number(debtor.totalDebt || 0).toLocaleString()} دج</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function KPICard({ title, value, icon, color, trend, isCount }) {
    const colors = {
        green: "bg-green-50 text-green-600 border-green-100",
        yellow: "bg-yellow-50 text-yellow-600 border-yellow-100",
        red: "bg-red-50 text-red-600 border-red-100",
        blue: "bg-blue-50 text-blue-600 border-blue-100",
    };

    return (
        <div className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-soft flex items-center gap-4 card-hover">
            <div className={`p-4 rounded-2xl ${colors[color].split(" ")[0]} ${colors[color].split(" ")[1]}`}>
                {icon}
            </div>
            <div>
                <p className="text-gray-400 font-bold text-xs mb-1">{title}</p>
                <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-black text-slate-800">
                        {value?.toLocaleString()}
                        {!isCount && <span className="text-xs text-gray-400 font-medium mr-1">دج</span>}
                    </h3>
                    {trend && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-md">{trend}</span>}
                </div>
            </div>
        </div>
    );
}