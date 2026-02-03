"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import Link from "next/link";
import { Store, ArrowRight, Search } from "lucide-react";

export default function RestaurantListPage() {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const fetchClients = async () => {
            const snapshot = await getDocs(collection(db, 'users'));
            const list = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(u => u.role === 'restaurant' && u.status !== 'archived');
            setClients(list.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '')));
            setLoading(false);
        };
        fetchClients();
    }, []);

    const filtered = clients.filter(c => (c.fullName || c.phone || '').toLowerCase().includes(searchTerm.toLowerCase()));

    if (loading) return <div className="h-screen flex items-center justify-center font-bold text-slate-400">جاري التحميل...</div>;

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-24">
            {/* Header */}
            <div className="bg-white px-4 py-4 sticky top-0 z-20 shadow-sm flex items-center gap-3">
                <Link href="/employee" className="bg-slate-100 p-2 rounded-full hover:bg-slate-200 transition">
                    <ArrowRight size={20} className="text-slate-600" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-xl font-black text-slate-800">مبيعات المطاعم 🍽️</h1>
                    <p className="text-xs font-bold text-slate-400">اختر الزبون لإنشاء طلبية</p>
                </div>
            </div>

            {/* Search */}
            <div className="px-4 py-3 sticky top-[72px] z-10 bg-slate-50/95 backdrop-blur">
                <div className="relative">
                    <Search className="absolute right-3 top-3 text-slate-400" size={20} />
                    <input
                        className="w-full bg-white rounded-2xl py-3 pr-10 pl-4 font-bold text-slate-700 outline-none shadow-sm focus:ring-2 focus:ring-orange-500 transition-all border border-slate-100"
                        placeholder="ابحث عن مطعم..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Grid */}
            <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                {filtered.map(client => (
                    <Link href={`/employee/clients/${client.id}`} key={client.id}>
                        <div className="bg-white p-4 rounded-[24px] shadow-sm border border-slate-100 active:scale-95 transition-all flex flex-col items-center text-center gap-3 group hover:border-orange-300">
                            <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center text-xl font-black">
                                {(client.fullName || "?").charAt(0)}
                            </div>
                            <div className="flex-1 w-full">
                                <h3 className="font-bold text-slate-800 text-sm line-clamp-1">{client.fullName || "بدون اسم"}</h3>
                                <div className="flex justify-center mt-2">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${client.currentDebt > 0 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                                        {client.currentDebt > 0 ? `${Math.round(client.currentDebt).toLocaleString()}` : 'خالص'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
