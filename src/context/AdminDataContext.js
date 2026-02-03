"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, limit } from "firebase/firestore";

const AdminDataContext = createContext();

export function AdminDataProvider({ children }) {
    const [products, setProducts] = useState([]);
    const [orders, setOrders] = useState([]);
    const [categories, setCategories] = useState([]);
    const [templates, setTemplates] = useState([]);

    // Loading states
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [loadingOrders, setLoadingOrders] = useState(true);

    // 1. Live Data (Products & Orders - Critical for Operations)
    useEffect(() => {
        // Products - Keep live for inventory sync
        const unsubProducts = onSnapshot(query(collection(db, "product"), orderBy("category")),
            (snapshot) => {
                setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setLoadingProducts(false);
            },
            (error) => {
                console.error("Products listener failed:", error);
                setLoadingProducts(false);
            }
        );

        // Orders - Live & Recent (Last 100)
        const UnsubOrdersQuery = query(
            collection(db, "order"),
            orderBy("created_at", "desc"),
            limit(100)
        );

        const unsubOrders = onSnapshot(UnsubOrdersQuery,
            (snapshot) => {
                setOrders(snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    formattedDate: doc.data().created_at?.toDate().toLocaleTimeString('ar-DZ', {
                        weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                    }) || "الآن"
                })));
                setLoadingOrders(false);
            },
            (error) => {
                console.error("Orders listener failed:", error);
                setLoadingOrders(false);
            }
        );

        // Categories Listener (Less Frequent but good to have live)
        const unsubCategories = onSnapshot(query(collection(db, "categories"), orderBy("created_at")),
            (snapshot) => {
                setCategories(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            }
        );

        // Templates Listener
        const unsubTemplates = onSnapshot(collection(db, "customization_templates"),
            (snapshot) => {
                setTemplates(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            }
        );

        return () => {
            unsubProducts();
            unsubOrders();
            unsubCategories();
            unsubTemplates();
        };
    }, []);

    const refreshStaticData = () => {
        // No-op or manual re-trigger if needed
    };

    const value = {
        products,
        orders,
        categories,
        templates,
        loading: loadingProducts || loadingOrders,
        refreshData: refreshStaticData,
        loadingProducts,
        loadingOrders
    };

    return (
        <AdminDataContext.Provider value={value}>
            {children}
        </AdminDataContext.Provider>
    );
}

export function useAdminData() {
    return useContext(AdminDataContext);
}
