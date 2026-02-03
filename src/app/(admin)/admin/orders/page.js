"use client";
import { useState, useMemo } from "react";
import {
    Clock, ShoppingBag, Truck, CheckCircle, Search, Filter, X,
    MoreHorizontal, Calendar, SlidersHorizontal, ChevronLeft, ChevronRight
} from "lucide-react";
import { useAdminData } from "@/context/AdminDataContext";
import OrderDrawer from "@/components/admin/OrderDrawer";

export default function OrdersPage() {
    const { orders: allOrders, loading, fetchAdminData } = useAdminData();
    const [statusFilter, setStatusFilter] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // 1. Stats Calculation
    const stats = useMemo(() => ({
        pending: allOrders.filter(o => o.order_status === 'pending').length,
        processing: allOrders.filter(o => o.order_status === 'processing').length,
        delivered: allOrders.filter(o => o.order_status === 'delivered').length,
        revenueToday: allOrders
            .filter(o => {
                const today = new Date().toISOString().split('T')[0];
                const orderDate = new Date(o.timestamp || o.created_at?.seconds * 1000).toISOString().split('T')[0];
                return orderDate === today && o.order_status === 'delivered';
            })
            .reduce((sum, o) => sum + (Number(o.order_total) || 0), 0)
    }), [allOrders]);

    // 2. Filtering Logic
    const filteredOrders = useMemo(() => {
        return allOrders.filter(order => {
            // Status Filter
            const statusMatch = statusFilter === 'all' || order.order_status === statusFilter;

            // Search Filter
            const searchLower = searchTerm.toLowerCase();
            const searchMatch =
                order.customer_name?.toLowerCase().includes(searchLower) ||
                order.order_number?.toString().includes(searchLower) ||
                order.customer_phone?.includes(searchLower);

            return statusMatch && searchMatch;
        });
    }, [allOrders, statusFilter, searchTerm]);

    const handleOrderClick = (order) => {
        setSelectedOrder(order);
        setIsDrawerOpen(true);
    };

    if (loading) return (
        <div className="flex h-screen items-center justify-center space-x-2 text-slate-400" dir="ltr">
            <div className="w-4 h-4 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-4 h-4 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-4 h-4 bg-slate-400 rounded-full animate-bounce"></div>
        </div>
    );

    return (
        <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">

            {/* 1. Header & Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-shrink-0">
                <StatCard
                    title="طلبات الانتظار"
                    value={stats.pending}
                    icon={<Clock className="text-amber-500" size={20} />}
                    color="amber"
                />
                <StatCard
                    title="قيد التجهيز"
                    value={stats.processing}
                    icon={<ShoppingBag className="text-blue-500" size={20} />}
                    color="blue"
                />
                <StatCard
                    title="المكتملة"
                    value={stats.delivered}
                    icon={<CheckCircle className="text-emerald-500" size={20} />}
                    color="emerald"
                />
                <StatCard
                    title="إيراد اليوم"
                    value={stats.revenueToday.toLocaleString()}
                    suffix="دج"
                    icon={<Calendar className="text-purple-500" size={20} />}
                    color="purple"
                    isMoney
                />
            </div>

            {/* 2. Toolbar */}
            <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3 flex-shrink-0">
                {/* Status Tabs */}
                <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-xl w-full md:w-auto overflow-x-auto no-scrollbar">
                    {['all', 'pending', 'processing', 'delivered', 'cancelled'].map(status => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap
                                ${statusFilter === status
                                    ? 'bg-white shadow text-slate-800'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                }
                            `}
                        >
                            {status === 'all' && 'الكل'}
                            {status === 'pending' && '⏳ انتظار'}
                            {status === 'processing' && '⚙️ تجهيز'}
                            {status === 'delivered' && '✅ مكتمل'}
                            {status === 'cancelled' && '❌ ملغي'}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative w-full md:w-64">
                    <Search className="absolute right-3 top-2.5 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="بحث برقم الطلب أو الاسم..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 border-none rounded-xl py-2 pr-9 pl-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-200"
                    />
                </div>
            </div>

            {/* 3. Orders Table (Scrollable) */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-soft flex-1 overflow-hidden flex flex-col relative">
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    <table className="w-full text-right">
                        <thead className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4">رقم الطلب</th>
                                <th className="px-6 py-4">الزبون</th>
                                <th className="px-6 py-4">الحالة</th>
                                <th className="px-6 py-4">المنتجات</th>
                                <th className="px-6 py-4">الإجمالي</th>
                                <th className="px-6 py-4">تاريخ الطلب</th>
                                <th className="px-6 py-4 text-center">إجراء</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="text-center py-24 text-slate-400">
                                        <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                                            <Search size={24} className="opacity-50" />
                                        </div>
                                        <p className="font-bold">لا توجد طلبات مطابقة</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map((order) => (
                                    <tr
                                        key={order.id}
                                        onClick={() => handleOrderClick(order)}
                                        className="hover:bg-blue-50/50 transition cursor-pointer group"
                                    >
                                        <td className="px-6 py-4">
                                            <span className="font-mono font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded text-xs">
                                                #{order.order_number}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-500">
                                                    {order.customer_name?.[0]}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm">{order.customer_name}</div>
                                                    <div className="text-[10px] text-slate-400">{order.customer_phone}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={order.order_status} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs font-bold text-slate-600 max-w-[200px] truncate">
                                                {order.order_items?.map(i => i.title).join(', ')}
                                            </div>
                                            <div className="text-[10px] text-slate-400">
                                                {order.order_items?.length || 0} عناصر
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-black text-slate-800 text-sm">
                                                {Number(order.order_total).toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-bold text-slate-400">
                                                {order.formattedDate}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-blue-600 transition">
                                                <ChevronLeft size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 4. Edit Sheet (Right Drawer) */}
            {isDrawerOpen && (
                <OrderDrawer
                    isOpen={isDrawerOpen}
                    onClose={() => setIsDrawerOpen(false)}
                    order={selectedOrder}
                    onUpdate={fetchAdminData} // Refresh Data after edit
                />
            )}
        </div>
    );
}

// Sub-components
function StatCard({ title, value, icon, color, suffix, isMoney }) {
    const colors = {
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        purple: 'bg-purple-50 text-purple-600 border-purple-100',
    };

    return (
        <div className={`p-4 rounded-2xl border ${colors[color].split(" ")[2]} bg-white shadow-sm flex flex-col gap-2 relative overflow-hidden`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color].split(" ")[0]} ${colors[color].split(" ")[1]}`}>
                {icon}
            </div>
            <div>
                <p className="text-xs font-bold text-slate-400">{title}</p>
                <p className={`text-xl font-black text-slate-800 ${isMoney ? 'tracking-tight' : ''}`}>
                    {value} <span className="text-xs font-medium text-slate-400">{suffix}</span>
                </p>
            </div>
        </div>
    );
}

function StatusBadge({ status }) {
    const styles = {
        pending: 'bg-amber-100 text-amber-700',
        processing: 'bg-blue-100 text-blue-700',
        shipped: 'bg-purple-100 text-purple-700',
        delivered: 'bg-emerald-100 text-emerald-700',
        cancelled: 'bg-red-100 text-red-700',
    };

    const labels = {
        pending: 'انتظار',
        processing: 'تجهيز',
        shipped: 'في الطريق',
        delivered: 'مكتمل',
        cancelled: 'ملغي',
    };

    return (
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
            {labels[status] || status}
        </span>
    );
}
