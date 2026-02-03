"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Lock, Phone, MapPin, Home } from "lucide-react";

import { Suspense } from 'react';

function SignupContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTarget = searchParams.get('redirect');
    const { signup } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [formData, setFormData] = useState({
        fullName: "",
        phone: "",
        password: "",
        zone: "بومرداس وسط",
        addressDetails: ""
    });

    // Dynamic Zones
    const [zones, setZones] = useState([]);
    useEffect(() => {
        const fetchZones = async () => {
            const snap = await getDocs(collection(db, "delivery_zone"));
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setZones(data);
            // Set default if exists
            if (data.length > 0) {
                setFormData(prev => ({ ...prev, zone: data[0].zone_name }));
            }
        };
        fetchZones();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const res = await signup(formData);
        if (res.success) {
            if (redirectTarget === 'track') {
                router.push("/track");
            } else {
                router.push("/");
            }
        } else {
            setError(res.error);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 flex flex-col justify-center pb-20">
            <Link href="/login" className="absolute top-6 left-6 p-2 bg-white rounded-full shadow-sm text-slate-500 hover:bg-slate-100">
                <ArrowLeft size={20} />
            </Link>

            <div className="text-center mb-6 mt-10">
                <h1 className="text-3xl font-black text-slate-800 mb-2">حساب جديد</h1>
                <p className="text-slate-400 font-medium text-sm">أدخل معلوماتك لتسهيل عملية الطلب مستقبلاً</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
                {error && <div className="p-3 bg-red-100 text-red-600 rounded-xl text-center font-bold text-sm">{error}</div>}

                {/* Name */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
                    <User className="text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="الاسم الكامل"
                        className="w-full outline-none font-bold text-slate-700 bg-transparent placeholder:text-slate-300"
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        required
                    />
                </div>

                {/* Phone */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
                    <Phone className="text-slate-400" size={18} />
                    <input
                        type="tel"
                        placeholder="رقم الهاتف (سيكون هو المعرف)"
                        className="w-full outline-none font-bold text-slate-700 bg-transparent placeholder:text-slate-300"
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        required
                    />
                </div>

                {/* Password */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
                    <Lock className="text-slate-400" size={18} />
                    <input
                        type="password"
                        placeholder="كلمة المرور"
                        className="w-full outline-none font-bold text-slate-700 bg-transparent placeholder:text-slate-300"
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                    />
                </div>

                {/* Zone */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3 relative">
                    <MapPin className="text-slate-400" size={18} />
                    <select
                        className="w-full outline-none font-bold text-slate-700 bg-transparent appearance-none"
                        onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                    >
                        {zones.length === 0 && <option>جاري التحميل...</option>}
                        {zones.map(z => <option key={z.id} value={z.zone_name}>{z.zone_name}</option>)}
                    </select>
                </div>

                {/* Address Details */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-start gap-3">
                    <Home className="text-slate-400 mt-1" size={18} />
                    <textarea
                        placeholder="تفاصيل العنوان (الحي، رقم المنزل، معلم قريب...)"
                        className="w-full outline-none font-bold text-slate-700 bg-transparent placeholder:text-slate-300 resize-none h-20"
                        onChange={(e) => setFormData({ ...formData, addressDetails: e.target.value })}
                        required
                    ></textarea>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition active:scale-95 disabled:opacity-70 mt-4"
                >
                    {loading ? "جاري التسجيل..." : "إنشاء الحساب"}
                </button>
            </form>

            <div className="mt-6 text-center">
                <p className="text-slate-400 font-bold text-sm">
                    لديك حساب بالفعل؟ <Link href="/login" className="text-red-600 underline">سجل دخولك</Link>
                </p>
            </div>
        </div>
    );
}

export default function SignupPage() {
    return (
        <Suspense>
            <SignupContent />
        </Suspense>
    );
}
