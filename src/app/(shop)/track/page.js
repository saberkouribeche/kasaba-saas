"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { Search, Package, Clock, CheckCircle, XCircle, ArrowRight, Truck, User } from "lucide-react";

export default function TrackOrderPage() {
    const { user, logout } = useAuth(); // Auth integration
    const [searchPhone, setSearchPhone] = useState("");
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    // Auto-search if user is logged in
    useEffect(() => {
        if (user) {
            handleSearch(null, user.phone);
        }
    }, [user]);

    const handleSearch = async (e, phoneOverride = null) => {
        if (e) e.preventDefault();
        const phone = phoneOverride || searchPhone;

        if (!phone) return;

        setLoading(true);
        setSearched(true);
        setOrders([]);

        try {
            // Index-free query (client side filtering if needed, but '==' is usually safe)
            // Note: Ideally use composite index for phone + created_at desc
            const q = query(
                collection(db, "order"),
                where("customer_phone", "==", phone)
            );

            const snapshot = await getDocs(q);
            const foundOrders = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Sort manually since we might not have index
            foundOrders.sort((a, b) => b.created_at?.seconds - a.created_at?.seconds);

            setOrders(foundOrders);
        } catch (error) {
            console.error("Error fetching orders:", error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusConfig = (status) => {
        switch (status) {
            case 'pending': return { color: "bg-amber-100 text-amber-600", icon: <Clock size={16} />, text: "قيد المراجعة" };
            case 'processing': return { color: "bg-blue-100 text-blue-600", icon: <Package size={16} />, text: "جاري التجهيز" };
            case 'shipped': return { color: "bg-purple-100 text-purple-600", icon: <Truck size={16} />, text: "خرج للتوصيل" };
            case 'delivered': return { color: "bg-green-100 text-green-600", icon: <CheckCircle size={16} />, text: "تم الاستلام" };
            case 'cancelled': return { color: "bg-red-100 text-red-600", icon: <XCircle size={16} />, text: "ملغي" };
            default: return { color: "bg-gray-100 text-gray-600", icon: <Clock size={16} />, text: status };
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-white p-6 pb-6 shadow-sm mb-6">
                <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-red-600 font-bold mb-4">
                    <ArrowRight size={20} /> العودة للمتجر
                </Link>
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800">
                            {user ? `مرحباً، ${user.fullName}` : "تتبع طلباتك"}
                        </h1>
                        <p className="text-slate-400 font-medium mt-1">
                            {user ? "قائمة طلباتك السابقة والحالية" : "أدخل رقم هاتفك لمعرفة حالة الطلب"}
                        </p>
                    </div>
                    {user && (
                        <button
                            onClick={logout}
                            className="text-xs font-bold text-red-500 bg-red-50 px-3 py-2 rounded-lg hover:bg-red-100"
                        >
                            تسجيل خروج
                        </button>
                    )}
                </div>
            </div>

            <div className="px-6">
                {/* Search Box (Only show if NOT logged in) */}
                {!user && (
                    <form onSubmit={handleSearch} className="mb-8">
                        <div className="relative flex shadow-soft rounded-2xl overflow-hidden bg-white">
                            <input
                                type="tel"
                                placeholder="رقم الهاتف (مثال: 0550...)"
                                className="flex-1 p-4 font-bold text-slate-700 outline-none placeholder:text-slate-300"
                                value={searchPhone}
                                onChange={(e) => setSearchPhone(e.target.value)}
                            />
                            <button
                                type="submit"
                                className="bg-slate-900 text-white px-6 font-bold hover:bg-red-600 transition flex items-center gap-2"
                            >
                                <Search size={20} /> <span className="hidden sm:inline">بحث</span>
                            </button>
                        </div>
                    </form>
                )}

                {/* Results */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mb-4"></div>
                        <p className="font-bold text-slate-400">جاري البحث...</p>
                    </div>
                ) : orders.length > 0 ? (
                    <div className="space-y-4 animate-fade-up">
                        {orders.map(order => {
                            const status = getStatusConfig(order.order_status);
                            return (
                                <div key={order.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                                    <div className="flex justify-between items-start mb-4 border-b border-slate-50 pb-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 ${status.color}`}>
                                                    {status.icon} {status.text}
                                                </span>
                                                <span className="text-slate-300 text-xs font-bold">#{order.order_number}</span>
                                            </div>
                                            <p className="text-slate-400 text-xs font-medium">
                                                {order.created_at?.seconds ? new Date(order.created_at.seconds * 1000).toLocaleDateString('ar-EG') : 'الآن'}
                                            </p>
                                        </div>
                                        <p className="text-xl font-black text-slate-800">{order.order_total} دج</p>
                                    </div>

                                    <div className="space-y-2">
                                        {order.order_items.map((item, i) => (
                                            <div key={i} className="flex justify-between items-center text-sm">
                                                <span className="font-bold text-slate-700">
                                                    <span className="text-red-500 mx-1">{item.quantity}x</span>
                                                    {item.title}
                                                </span>
                                                <span className="text-slate-400 font-medium">{item.price * item.quantity} دج</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Show delivery address if user is logged in */}
                                    {order.delivery_address_details && (
                                        <div className="mt-4 pt-3 border-t border-slate-50 text-xs text-slate-400 font-medium flex items-start gap-2">
                                            <CheckCircle size={14} className="mt-0.5 text-slate-300" />
                                            <span>
                                                توصيل إلى: {order.delivery_area} - {order.delivery_address_details}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : searched ? (
                    <div className="text-center py-12 opacity-60">
                        <Package size={64} className="mx-auto text-slate-300 mb-4" />
                        <h3 className="font-bold text-slate-600 text-lg">لا توجد طلبات مسجلة</h3>
                        <p className="text-slate-400">تأكد من رقم الهاتف أو ابدأ التسوق الآن</p>
                        {!user && (
                            <div className="mt-6">
                                <Link href="/login" className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-600/20">
                                    تسجيل الدخول / استعراض طلباتي
                                </Link>
                            </div>
                        )}
                    </div>
                ) : (
                    // Empty Initial State (Only for guests)
                    <div className="text-center py-12 opacity-60">
                        <Search size={64} className="mx-auto text-slate-300 mb-4" />
                        <h3 className="font-bold text-slate-600 text-lg">ابحث عن طلباتك</h3>
                        <div className="mt-4 flex flex-col items-center gap-3">
                            <Link href="/login" className="bg-white text-slate-800 border border-slate-200 px-6 py-3 rounded-xl font-bold hover:bg-slate-50">
                                تسجيل الدخول
                            </Link>
                            <Link href="/signup" className="text-red-500 font-bold underline text-sm">
                                إنشاء حساب جديد
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
