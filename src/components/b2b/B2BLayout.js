"use client";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { LogOut, ChevronLeft, Store } from "lucide-react";
import B2BAuthGuard from "./B2BAuthGuard";

import { notify } from "@/lib/notify";

export default function B2BLayout({ children }) {
    const pathname = usePathname();
    const router = useRouter();
    const { logout, user } = useAuth();

    // Determine page title based on path
    const getPageTitle = () => {
        if (pathname.includes("/new-order")) return "طلب جديد";
        if (pathname.includes("/dashboard")) return "لوحة التحكم";
        return "المطعم";
    };

    const isDashboard = pathname === "/b2b/dashboard";

    const handleBack = () => {
        router.push("/b2b/dashboard");
    };

    const handleLogout = async () => {
        if (await notify.confirm("تسجيل الخروج", "هل تريد فعلاً تسجيل الخروج؟", "نعم، خروج", "بقاء")) {
            await logout();
            router.replace("/login");
        }
    };

    return (
        <B2BAuthGuard>
            <div className="min-h-screen bg-gray-50 pb-safe-area">
                {/* Sticky Header - Hidden on Order Sheet (/b2b) to prevent double headers */}
                {pathname !== '/b2b' && (
                    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm px-4 py-3 pb-safe-top">
                        <div className="flex items-center justify-between max-w-md mx-auto w-full">
                            {/* Left: Back Button or Logo */}
                            <div className="w-10">
                                {!isDashboard ? (
                                    <button
                                        onClick={handleBack}
                                        className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full transition active:scale-95"
                                    >
                                        <ChevronLeft size={24} />
                                    </button>
                                ) : (
                                    <div className="text-red-600">
                                        <Store size={24} />
                                    </div>
                                )}
                            </div>

                            {/* Center: Title */}
                            <h1 className="font-black text-lg text-slate-800 absolute left-1/2 -translate-x-1/2">
                                {getPageTitle()}
                            </h1>

                            {/* Right: Logout */}
                            <div className="w-10 flex justify-end">
                                <button
                                    onClick={handleLogout}
                                    className="p-2 -mr-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition active:scale-95"
                                    title="تسجيل الخروج"
                                >
                                    <LogOut size={20} />
                                </button>
                            </div>
                        </div>
                    </header>
                )}

                {/* Main Content */}
                <main className="max-w-md mx-auto w-full animate-fade-in">
                    {children}
                </main>
            </div>
        </B2BAuthGuard>
    );
}
