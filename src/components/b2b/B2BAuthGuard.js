"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function B2BAuthGuard({ children }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        if (!loading) {
            if (!user) {
                // Not logged in -> Redirect to login
                console.log("B2BGuard: No user, redirecting to login");
                router.replace("/login");
            } else if (user.role !== "restaurant") {
                // Logged in but not restaurant -> Redirect home
                console.log("B2BGuard: Invalid role, redirecting home");
                router.replace("/");
            } else {
                // Authorized
                setIsAuthorized(true);

                // History Management: Push a dummy state to trap back button
                // This prevents accidental exit on mobile swipe-back
                window.history.pushState(null, "", pathname);

                const handlePopState = (event) => {
                    // Prevent back navigation
                    window.history.pushState(null, "", pathname);

                    // Optional: Show logout confirmation here if needed
                    // For now, we just trap the user in the app logic
                    // logic can be extended to show a modal
                };

                window.addEventListener("popstate", handlePopState);
                return () => window.removeEventListener("popstate", handlePopState);
            }
        }
    }, [user, loading, router, pathname]);

    if (loading || !isAuthorized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-red-600" size={40} />
                    <p className="text-slate-400 font-bold text-sm animate-pulse">جاري التحقق من الصلاحيات...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
