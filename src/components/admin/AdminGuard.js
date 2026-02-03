"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ShieldAlert } from "lucide-react";
import { can, isAdmin, isEmployee } from "@/lib/permissions";

export default function AdminGuard({ children }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        if (loading) return;

        // 1. Check if user is staff (Admin or Employee)
        const isStaff = isAdmin(user) || isEmployee(user);

        if (isStaff) {
            if (pathname === "/login") {
                router.replace("/admin");
                return;
            }
            // RBAC: Employee Restrictions
            // Employees can ONLY access POS and Orders
            if (isEmployee(user) && !isAdmin(user)) {
                // If trying to access main dashboard, redirect to POS
                if (pathname === '/admin') {
                    router.replace('/admin/pos');
                    return;
                }

                const allowedRoutes = ['/admin/pos', '/admin/orders'];
                const isAllowed = allowedRoutes.some(route => pathname.startsWith(route));

                if (!isAllowed) {
                    setAuthorized(false);
                    return;
                }
            }

            setAuthorized(true);
        } else {
            // Not Staff
            if (user) {
                // Logged in but not staff (e.g. Client trying to access admin)
                setAuthorized(false);
            } else {
                // Not logged in
                if (pathname !== "/login") {
                    router.replace("/login");
                }
            }
        }
    }, [user, loading, pathname, router]);

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-100 flex-col gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
                <p className="text-slate-400 font-bold animate-pulse">جاري التحقق من الصلاحيات...</p>
            </div>
        );
    }

    // Access Denied State
    if (user && !authorized && pathname !== "/login") {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-slate-50 flex-col gap-6 p-4 text-center">
                <ShieldAlert size={64} className="text-red-500" />
                <div>
                    <h1 className="text-2xl font-black text-slate-800">وصول مرفوض</h1>
                    <p className="text-slate-500 font-medium mt-2">
                        حسابك الحالي ({user.fullName}) لا يملك صلاحيات للوصول لهذه الصفحة.
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Role: {user.role || 'None'}</p>
                </div>
                <button
                    onClick={() => {
                        localStorage.removeItem("kasaba_user_phone");
                        window.location.href = "/login";
                    }}
                    className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition"
                >
                    تسجيل الخروج
                </button>
            </div>
        );
    }

    if (!authorized && pathname !== "/admin/login") {
        return null; // Don't render children until authorized
    }

    return children;
}
