"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Lock, ExternalLink } from "lucide-react";
import toast from 'react-hot-toast';

export default function LoginPage() {
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const { login } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const res = await login(phone, password);
        if (res.success) {
            toast.success("تم تسجيل الدخول بنجاح");

            // Check Role and Redirect
            // Check Role and Redirect
            if (res.user?.role === 'admin') {
                router.push("/admin");
            } else if (res.user?.role === 'employee') {
                router.replace("/employee");
            } else if (res.user?.role === 'restaurant') {
                router.replace("/b2b/dashboard"); // Use replace to prevent back navigation to login
            } else {
                router.push("/");
            }
        } else {
            setError(res.error);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 flex flex-col justify-center">
            <Link href="/" className="absolute top-6 left-6 p-2 bg-white rounded-full shadow-sm text-slate-500 hover:bg-slate-100">
                <ArrowLeft size={20} />
            </Link>

            <div className="text-center mb-8">
                <h1 className="text-3xl font-black text-red-600 mb-2">تسجيل الدخول</h1>
                <p className="text-slate-400 font-medium">مرحباً بك مجدداً في قصابة المسجد</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <div className="p-3 bg-red-100 text-red-600 rounded-xl text-center font-bold text-sm">{error}</div>}

                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
                    <User className="text-slate-400" size={20} />
                    <input
                        type="tel"
                        placeholder="رقم الهاتف"
                        className="w-full outline-none font-bold text-slate-700 bg-transparent placeholder:text-slate-300"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.trim())}
                        required
                    />
                </div>

                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
                    <Lock className="text-slate-400" size={20} />
                    <input
                        type="password"
                        placeholder="كلمة المرور"
                        className="w-full outline-none font-bold text-slate-700 bg-transparent placeholder:text-slate-300"
                        value={password}
                        onChange={(e) => setPassword(e.target.value.trim())}
                        required
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-red-600/20 hover:bg-red-700 transition active:scale-95 disabled:opacity-70"
                >
                    {loading ? "جاري الدخول..." : "دخول"}
                </button>
            </form>

            <div className="mt-8 text-center space-y-4">
                <p className="text-slate-400 font-bold">
                    ليس لديك حساب؟ <Link href="/signup" className="text-slate-900 underline">إنشاء حساب جديد</Link>
                </p>
                <Link href="/" className="inline-block text-sm text-slate-400 font-medium hover:text-slate-600">
                    متابعة كزائر (بدون تسجيل)
                </Link>
            </div>
        </div>
    );
}
