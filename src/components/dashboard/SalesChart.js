"use client";
import { useState, useEffect, useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { Loader2, TrendingUp, PieChart as PieIcon } from 'lucide-react';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']; // Emerald Primary

export default function SalesChart() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch last 7 days of Sales (ORDER_PLACED)
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                sevenDaysAgo.setHours(0, 0, 0, 0);

                const q = query(
                    collection(db, 'transactions'),
                    where('type', '==', 'ORDER_PLACED'), // Ensure we only get Sales
                    where('createdAt', '>=', sevenDaysAgo),
                    orderBy('createdAt', 'asc') // Ascending for Chart Sequence
                );

                const snapshot = await getDocs(q);
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setTransactions(data);
            } catch (error) {
                console.error("Error fetching analytics:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // 1. Weekly Sales Data (Last 7 Days)
    const weeklySalesData = useMemo(() => {
        const last7Days = [...Array(7)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d;
        }).reverse(); // [Today-6, ..., Today]

        return last7Days.map(dateObj => {
            const dateStr = dateObj.toISOString().split('T')[0];
            const dayTotal = transactions
                .filter(t => {
                    const tDate = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.timestamp);
                    return tDate.toISOString().split('T')[0] === dateStr;
                })
                .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

            return {
                name: dateObj.toLocaleDateString('ar-DZ', { weekday: 'long' }), // Arabic Day Name
                date: dateStr,
                sales: dayTotal
            };
        });
    }, [transactions]);

    // 2. Category/Product Share Data
    const categoryData = useMemo(() => {
        const catMap = {};
        transactions.forEach(t => {
            if (t.order_items) {
                t.order_items.forEach(item => {
                    // Fallback to Title if Category missing
                    const key = item.category || item.title || 'منتج عام';
                    catMap[key] = (catMap[key] || 0) + (Number(item.total_price) || 0);
                });
            }
        });

        const sorted = Object.entries(catMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5); // Top 5

        return sorted.length > 0 ? sorted : [{ name: 'لا توجد بيانات', value: 1 }];
    }, [transactions]);

    if (loading) {
        return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-emerald-500" /></div>;
    }

    if (transactions.length === 0) return null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Bar Chart: Weekly Sales */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                    <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl">
                        <TrendingUp size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">المبيعات الأسبوعية</h3>
                        <p className="text-xs text-slate-400 font-bold">آخر 7 أيام</p>
                    </div>
                </div>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklySalesData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(value) => `${value / 1000}k`}
                            />
                            <Tooltip
                                cursor={{ fill: '#ecfdf5' }}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                formatter={(value) => [`${Number(value).toLocaleString()} دج`, 'المبيعات']}
                            />
                            <Bar dataKey="sales" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Pie Chart: Top Products */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                    <div className="bg-blue-50 text-blue-600 p-2 rounded-xl">
                        <PieIcon size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">أكثر التصنيفات بيعاً</h3>
                        <p className="text-xs text-slate-400 font-bold">حسب القيمة (أعلى 5)</p>
                    </div>
                </div>
                <div className="h-64 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={categoryData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {categoryData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value) => `${Number(value).toLocaleString()} دج`} />
                            <Legend
                                verticalAlign="bottom"
                                align="center"
                                iconType="circle"
                                wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '10px' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
