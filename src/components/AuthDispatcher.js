"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSearchParams, useRouter } from "next/navigation";
import ShopClient from "@/app/(shop)/ShopClient";
import SplashScreen from "@/components/SplashScreen";

export default function AuthDispatcher({ initialProducts, initialCategories, initialBanners }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [showSplash, setShowSplash] = useState(true);
    const searchParams = useSearchParams();
    const isB2BMode = searchParams.get('b2b_mode') === 'true';

    // Safety timeout: If nothing happens for 4 seconds, force remove splash
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowSplash(false);
        }, 4000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!loading) {
            if (user?.role === 'restaurant') {
                if (isB2BMode) {
                    // Restaurant wants to shop -> Allow it
                    setShowSplash(false);
                } else {
                    // Restaurant default -> Go to Dashboard
                    router.replace('/b2b/dashboard');
                    // We technically keep splash here while redirecting
                }
            } else if (user?.role === 'employee') {
                router.replace('/employee');
            } else {
                // Customer or Guest -> Show Store
                setShowSplash(false);
            }
        }
    }, [user, loading, router, isB2BMode]);

    if (showSplash) {
        return <SplashScreen />;
    }

    return (
        <ShopClient
            initialProducts={initialProducts}
            initialCategories={initialCategories}
            initialBanners={initialBanners}
        />
    );
}
