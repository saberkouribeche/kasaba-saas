"use client";
import Link from "next/link";
import { Truck, Store, ArrowRight, Scale } from "lucide-react";

export default function EmployeeGateway() {
    return (
        <div className="min-h-screen bg-slate-50 font-sans p-6 flex flex-col items-center justify-center gap-6">

            <div className="text-center mb-4">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">بوابة الموظفين 🚀</h1>
                <p className="text-slate-500 font-bold text-sm">اختر نظام العمل للمتابعة</p>
            </div>

            <div className="w-full max-w-md space-y-4">

                {/* 🚚 SUPPLY CHAIN CARD */}
                <Link href="/employee/suppliers" className="block group">
                    <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white p-8 rounded-[32px] shadow-2xl shadow-blue-900/20 active:scale-95 transition-all relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            <Truck size={120} />
                        </div>

                        <div className="relative z-10">
                            <div className="bg-white/20 w-14 h-14 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm">
                                <Truck size={32} />
                            </div>
                            <h2 className="text-2xl font-black mb-1">المشتريات</h2>
                            <p className="font-bold text-blue-200 text-sm">إدارة الموردين واستلام المخزون</p>
                        </div>

                        <div className="absolute bottom-8 left-8 bg-white/20 p-2 rounded-full backdrop-blur-sm group-hover:translate-x-[-5px] transition-transform">
                            <ArrowRight size={20} />
                        </div>
                    </div>
                </Link>

                {/* 🍽️ B2B SALES CARD */}
                <Link href="/employee/clients" className="block group">
                    <div className="bg-gradient-to-br from-orange-500 to-red-600 text-white p-8 rounded-[32px] shadow-2xl shadow-orange-900/20 active:scale-95 transition-all relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            <Store size={120} />
                        </div>

                        <div className="relative z-10">
                            <div className="bg-white/20 w-14 h-14 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm">
                                <Store size={32} />
                            </div>
                            <h2 className="text-2xl font-black mb-1">مبيعات المطاعم</h2>
                            <p className="font-bold text-orange-200 text-sm">إدارة الزبائن وطلبات التوزيع</p>
                        </div>

                        <div className="absolute bottom-8 left-8 bg-white/20 p-2 rounded-full backdrop-blur-sm group-hover:translate-x-[-5px] transition-transform">
                            <ArrowRight size={20} />
                        </div>
                    </div>
                </Link>

                {/* ⚖️ INVENTORY COUNT CARD */}
                <Link href="/employee/inventory" className="block group">
                    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-8 rounded-[32px] shadow-2xl shadow-emerald-900/20 active:scale-95 transition-all relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            <Scale size={120} />
                        </div>

                        <div className="relative z-10">
                            <div className="bg-white/20 w-14 h-14 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm">
                                <Scale size={32} />
                            </div>
                            <h2 className="text-2xl font-black mb-1">جرد المخزون</h2>
                            <p className="font-bold text-emerald-100 text-sm">مراقبة الكميات والتحقق الدوري</p>
                        </div>

                        <div className="absolute bottom-8 left-8 bg-white/20 p-2 rounded-full backdrop-blur-sm group-hover:translate-x-[-5px] transition-transform">
                            <ArrowRight size={20} />
                        </div>
                    </div>
                </Link>

            </div>

            <p className="text-slate-400 text-xs font-bold mt-8">© Kasaba System v2.0</p>
        </div>
    );
}
