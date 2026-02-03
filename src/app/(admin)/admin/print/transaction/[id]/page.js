"use client";
import { useEffect, useState } from "react";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ThermalTransactionReceipt from "@/components/admin/ThermalTransactionReceipt";
import { useParams, useSearchParams } from "next/navigation";

export default function TransactionPrintPage() {
    const { id } = useParams();
    const searchParams = useSearchParams();
    const [transaction, setTransaction] = useState(null);
    const [entity, setEntity] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const type = searchParams.get('type'); // 'supplier' or 'general'
    const userId = searchParams.get('userId'); // Supplier ID or Client ID

    useEffect(() => {
        if (!id || !type || !userId) {
            setError("Missing parameters");
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                // 1. Fetch Entity (Supplier or User)
                let entityData = null;
                if (type === 'supplier') {
                    const supplierRef = doc(db, 'suppliers', userId);
                    const snap = await getDoc(supplierRef);
                    if (snap.exists()) entityData = { ...snap.data(), role: 'supplier' };
                } else {
                    const userRef = doc(db, 'users', userId);
                    const snap = await getDoc(userRef);
                    if (snap.exists()) entityData = { ...snap.data(), role: 'client' };
                }
                setEntity(entityData);

                // 2. Fetch Transaction
                let txData = null;
                if (type === 'supplier') {
                    const txRef = doc(db, `suppliers/${userId}/transactions`, id);
                    const snap = await getDoc(txRef);
                    if (snap.exists()) txData = { id: snap.id, ...snap.data() };
                } else {
                    // General Transactions (Restaurants)
                    // Try top-level 'transactions' collection first
                    const txRef = doc(db, 'transactions', id);
                    const snap = await getDoc(txRef);
                    if (snap.exists()) {
                        txData = { id: snap.id, ...snap.data() };
                    } else {
                        // Fallback: Check if it's an order masquerading as tx (handled in StatementModal but less likely to be linked directly here unless unified)
                        // For now, assume top level transaction.
                    }
                }

                if (txData) {
                    setTransaction(txData);
                } else {
                    setError("Transaction not found");
                }

            } catch (err) {
                console.error("Error fetching print data:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id, type, userId]);

    useEffect(() => {
        if (transaction && entity && !loading) {
            // Small delay to ensure render is complete before printing
            const timer = setTimeout(() => {
                window.print();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [transaction, entity, loading]);

    if (loading) return <div className="p-10 text-center font-bold">جاري تحميل الإيصال...</div>;
    if (error) return <div className="p-10 text-center text-red-500 font-bold">{error}</div>;

    return (
        <div className="bg-white min-h-screen flex justify-center items-start pt-10">
            <ThermalTransactionReceipt
                transaction={transaction}
                entity={entity}
                isPrintPage={true}
            />
        </div>
    );
}
