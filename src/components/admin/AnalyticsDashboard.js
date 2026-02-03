"use client";
import { useState, useMemo, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell
} from 'recharts';
import {
    TrendingUp, DollarSign, ShoppingBag, Filter, RefreshCw
} from "lucide-react";

export default function AnalyticsDashboard() {
    const [timeRange, setTimeRange] = useState("month"); // day, week, month, year
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- 1. Fetch Accurate Data ---
    useEffect(() => {
        const fetchAnalyticsData = async () => {
            setLoading(true);
            try {
                const now = new Date();
                let startDate = new Date();

                // Determine Start Date
                if (timeRange === 'day') {
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today
                } else if (timeRange === 'week') {
                    startDate.setDate(now.getDate() - 7);
                } else if (timeRange === 'month') {
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1); // Start of month
                } else if (timeRange === 'year') {
                    startDate = new Date(now.getFullYear(), 0, 1); // Start of year
                }

                // Query: Fetch ALL orders for this period (Not limited)
                // Note: Index on 'created_at' is required.
                const q = query(
                    collection(db, "order"),
                    where("created_at", ">=", Timestamp.fromDate(startDate)),
                    orderBy("created_at", "asc") // Sort for charts
                );

                const snapshot = await getDocs(q);

                // Process Data Client-Side (Filtering cancelled here to catch all variants)
                const fetchedOrders = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    // Parse date safely
                    createdAtDate: doc.data().created_at?.toDate ? doc.data().created_at.toDate() : new Date(doc.data().created_at)
                })).filter(o => o.order_status !== 'cancelled' && o.order_status !== 'ملغى');

                setOrders(fetchedOrders);
            } catch (error) {
                console.error("Analytics Fetch Error:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalyticsData();
    }, [timeRange]);

    // --- 2. Calculate KPIs ---
    const kpis = useMemo(() => {
        const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.order_total) || 0), 0);
        const totalOrders = orders.length;
        const avgBasket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        return { totalRevenue, totalOrders, avgBasket };
    }, [orders]);

    // --- 3. Prepare Chart Data ---
    const chartData = useMemo(() => {
        const dataMap = new Map();

        orders.forEach(order => {
            const date = order.createdAtDate;
            let key = "";
            let label = "";

            if (timeRange === 'day') {
                key = date.getHours().toString();
                label = `${date.getHours()}:00`;
            } else if (timeRange === 'week' || timeRange === 'month') {
                key = date.toDateString();
                label = date.toLocaleDateString('ar-DZ', { weekday: 'short', day: 'numeric' });
            } else {
                key = `${date.getFullYear()}-${date.getMonth()}`;
                label = date.toLocaleDateString('ar-DZ', { month: 'short' });
            }

            if (!dataMap.has(key)) {
                dataMap.set(key, { name: label, value: 0, orders: 0, originalDate: date });
            }

            const entry = dataMap.get(key);
            entry.value += (Number(order.order_total) || 0);
            entry.orders += 1;
        });

        return Array.from(dataMap.values()).sort((a, b) => a.originalDate - b.originalDate);
    }, [orders, timeRange]);

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs text-right" dir="rtl">
                    <p className="font-bold mb-2 text-slate-300">{label}</p>
                    <p className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                        الدخل: <span className="font-mono font-bold text-lg">{payload[0].value.toLocaleString()}</span> دج
                    </p>
                    {payload[0].payload && (
                        <p className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                            الطلبات: <span className="font-bold">{payload[0].payload.orders}</span>
                        </p>
                    )}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6 animate-fade-up">

            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-slate-900 p-3 rounded-2xl text-white">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800">تحليل المبيعات</h2>
                        <p className="text-xs text-slate-400 font-bold">
                            {loading ? "جاري التحديث..." : "إحصائيات دقيقة (Live)"}
                        </p>
                    </div>
                </div>

                <div className="flex bg-slate-100 p-1.5 rounded-xl font-bold text-xs">
                    {[
                        { id: 'day', label: 'اليوم' },
                        { id: 'week', label: 'أسبوع' },
                        { id: 'month', label: 'شهر' },
                        { id: 'year', label: 'سنة' },
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTimeRange(t.id)}
                            className={`px-4 py-2 rounded-lg transition-all ${timeRange === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Revenue */}
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-6 text-white relative overflow-hidden group">
                    {/* Decorative Elements */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>

                    <p className="text-blue-100 font-bold text-sm mb-2 flex items-center gap-2">
                        <DollarSign size={16} /> مجموع الإيرادات
                    </p>
                    {loading ? (
                        <div className="h-10 w-32 bg-white/20 animate-pulse rounded-lg"></div>
                    ) : (
                        <h3 className="text-4xl font-black tracking-tight flex items-baseline gap-1">
                            {kpis.totalRevenue.toLocaleString()} <span className="text-sm font-medium opacity-70">دج</span>
                        </h3>
                    )}
                </div>

                {/* Orders */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-orange-200 transition-colors">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 font-bold text-xs uppercase mb-1">إجمالي الطلبات</p>
                            {loading ? <div className="h-8 w-16 bg-slate-100 animate-pulse rounded-lg"></div> : (
                                <h3 className="text-3xl font-black text-slate-800">{kpis.totalOrders}</h3>
                            )}
                        </div>
                        <div className="bg-orange-50 text-orange-600 p-3 rounded-2xl group-hover:scale-110 transition-transform">
                            <ShoppingBag size={24} />
                        </div>
                    </div>
                </div>

                {/* Avg Basket */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-emerald-200 transition-colors">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-400 font-bold text-xs uppercase mb-1">متوسط السلة</p>
                            {loading ? <div className="h-8 w-24 bg-slate-100 animate-pulse rounded-lg"></div> : (
                                <h3 className="text-3xl font-black text-slate-800 flex items-baseline gap-1">
                                    {kpis.avgBasket.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-sm text-slate-400">دج</span>
                                </h3>
                            )}
                        </div>
                        <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl group-hover:scale-110 transition-transform">
                            <Filter size={24} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Revenue Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm min-h-[350px]">
                    <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <TrendingUp size={20} className="text-blue-500" /> نمو الإيرادات
                    </h3>
                    <div className="h-[300px] w-full dir-ltr">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 'bold' }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}
                                    tickFormatter={(value) => `${value / 1000}k`}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '5 5' }} />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#3b82f6"
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#colorRevenue)"
                                    activeDot={{ r: 8, strokeWidth: 0, fill: '#1d4ed8' }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Secondary Orders Chart */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm min-h-[350px]">
                    <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <ShoppingBag size={20} className="text-orange-500" /> عدد الطلبات
                    </h3>
                    <div className="h-[300px] w-full dir-ltr">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    hide
                                />
                                <Tooltip
                                    cursor={{ fill: '#fff7ed' }}
                                    content={<CustomTooltip />}
                                />
                                <Bar dataKey="orders" fill="#f97316" radius={[6, 6, 0, 0]}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#f97316' : '#fb923c'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
