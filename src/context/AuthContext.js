"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { signInWithCustomToken, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "firebase/auth";
import { useRouter } from "next/navigation";

const AuthContext = createContext({
    user: null,
    loading: true,
    login: async () => ({ success: false, error: "Context not initialized" }),
    signup: async () => ({ success: false, error: "Context not initialized" }),
    logout: () => { }
});

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Core Authentication Logic: Safe & Robust
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            try {
                if (currentUser) {
                    let docIdToSearch = currentUser.uid; // Default fallback

                    // STRATEGY: Extract Phone from "Fake Email" Login
                    // If login is "0540030932@kasaba.com", we want "0540030932"
                    if (currentUser.email) {
                        const phonePart = currentUser.email.split('@')[0];
                        // Validate if it looks like a phone number (digits only)
                        if (/^\d+$/.test(phonePart)) {
                            docIdToSearch = phonePart;
                            console.log("🔍 Detected Phone ID strategy:", docIdToSearch);
                        }
                    }

                    // Attempt to fetch profile from Firestore
                    let additionalData = {};
                    let role = 'client'; // Default fallback

                    try {
                        const userDocRef = doc(db, 'users', docIdToSearch);
                        const userDoc = await getDoc(userDocRef);

                        if (userDoc.exists()) {
                            additionalData = userDoc.data();
                            role = additionalData.role || 'client';
                        } else {
                            console.warn("User authenticated but no Firestore doc found for ID:", docIdToSearch);
                        }
                    } catch (docError) {
                        console.error("Error fetching user profile:", docError);
                    }

                    // Merge Auth User + Firestore Data
                    setUser({
                        uid: currentUser.uid,
                        email: currentUser.email,
                        phoneNumber: currentUser.phoneNumber || additionalData.phone,
                        ...additionalData,
                        role: role,
                        dbId: docIdToSearch // Store for reference
                    });

                } else {
                    console.log("Auth State Changed: No User");
                    setUser(null);
                }
            } catch (err) {
                console.error("Auth Context Critical Error:", err);
                setUser(null);
            } finally {
                // CRITICAL: Always turn off loader
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);



    // ... inside AuthProvider

    const login = async (phone, password) => {
        console.log("🚀 Login Initiated", { phone }); // DEBUG
        setLoading(true);
        try {
            // 0. Ensure Persistence is Local (Solves Session Expiry)
            console.log("🔒 Setting Persistence..."); // DEBUG
            await setPersistence(auth, browserLocalPersistence);
            console.log("✅ Persistence Set"); // DEBUG

            // 1. Get Token from Server
            console.log("📡 Calling API..."); // DEBUG
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, password })
            });
            console.log("📥 API Response Status:", res.status); // DEBUG


            const data = await res.json();
            console.log("📦 API Data:", data); // DEBUG

            if (data.success && data.token) {
                // 2. Sign in (Triggers onAuthStateChanged)
                console.log("🔑 Signing in with Custom Token..."); // DEBUG
                await signInWithCustomToken(auth, data.token);
                console.log("🎉 Sign In Complete"); // DEBUG

                // No need to setUser, effect handles it
                return { success: true, user: data.user };
            } else {
                console.warn("❌ Login Failed Logic:", data.error);
                setLoading(false);
                return { success: false, error: data.error || "بيانات الدخول غير صحيحة" };
            }
        } catch (error) {
            console.error("🔥 Login Network Error:", error);
            setLoading(false);
            return { success: false, error: "فشل الاتصال بالسيرفر" };
        }
    };

    const signup = async (userData) => {
        setLoading(true);
        try {
            const res = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });

            const data = await res.json();

            if (data.success) {
                // If API returns a token, auto-login
                if (data.token) {
                    await setPersistence(auth, browserLocalPersistence);
                    await signInWithCustomToken(auth, data.token);
                } else {
                    // If no token (unlikely with our setup), just redirect to login
                    // or let the user manually login.
                    setLoading(false);
                }
                return { success: true };
            } else {
                setLoading(false);
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error("Signup Error:", error);
            setLoading(false);
            return { success: false, error: "فشل إنشاء الحساب" };
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
            setUser(null);
            // Clear legacy items just in case
            localStorage.removeItem("kasaba_user_phone");
            localStorage.removeItem("kasaba_user_data");
            router.push("/login");
        } catch (e) { console.error("Signout error", e); }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
