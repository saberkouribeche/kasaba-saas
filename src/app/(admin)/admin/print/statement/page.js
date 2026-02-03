"use client";
import { useEffect, useState, Suspense } from "react";
import { doc, getDoc, collection, query, where, getDocs, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ThermalStatementReceipt from "@/components/admin/ThermalStatementReceipt";
import { useSearchParams } from "next/navigation";

// Separate component to useSearchParams inside Suspense
function PrintContent() {
    const searchParams = useSearchParams();
    const [transactions, setTransactions] = useState([]);
    const [client, setClient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const clientId = searchParams.get('clientId');
    const idsString = searchParams.get('ids');

    useEffect(() => {
        if (!clientId || !idsString) {
            setError("Missing parameters (clientId or ids)");
            setLoading(false);
            return;
        }

        const ids = idsString.split(',');

        const fetchData = async () => {
            try {
                // 1. Fetch Client
                const clientRef = doc(db, 'users', clientId); // Restaurants are users in 'users' collection usually? Or 'restaurants'?
                // Admin page uses 'users' collection for clients (restaurants).
                // Let's verify 'users' or 'custom_clients'??
                // Checking previous code: StatementModal uses 'users' via props usually passing user object.
                // admin/restaurants/page.js fetches from "users" where role is 'client'.

                const clientSnap = await getDoc(clientRef);
                let clientData = null;
                if (clientSnap.exists()) {
                    clientData = { id: clientSnap.id, ...clientSnap.data() };
                } else {
                    // Fallback check if it's a supplier? Unlikely for "Restaurant Statement"
                    throw new Error("Client not found");
                }
                setClient(clientData);

                // 2. Fetch Transactions
                // Firestore 'in' query supports max 10/30 items. If ids > 10, might need multiple queries.
                // Or just fetch all client transactions and filter in JS (might be heavy if 1000s).
                // Better: Iterate and fetch via getDoc (Parallel) since we have IDs.

                // Note: Restaurant transactions are in top-level 'transactions' or 'orders' masquerading.
                // We assume IDs are from 'transactions' collection as StatementModal uses.

                const txPromises = ids.map(id => getDoc(doc(db, 'transactions', id)).then(snap => snap.exists() ? { id: snap.id, ...snap.data() } : null));
                const txResults = await Promise.all(txPromises);
                const foundTxs = txResults.filter(t => t);

                // Sort by date (oldest first? or newest first?)
                // User asked for "Group of bills", usually chronological makes sense.
                foundTxs.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));

                setTransactions(foundTxs);

            } catch (err) {
                console.error("Error fetching batch print data:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [clientId, idsString]);

    useEffect(() => {
        if (transactions.length > 0 && client && !loading) {
            const timer = setTimeout(() => {
                window.print();
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [transactions, client, loading]);

    if (loading) return <div className="p-10 text-center font-bold">جاري تحميل القائمة...</div>;
    if (error) return <div className="p-10 text-center text-red-500 font-bold">{error}</div>;

    // Use current Debt from client profile
    // Note: client.debt might be updated by cloud functions. 
    // If we want absolutely real-time, we could calculate it, but client.debt is standard.
    const currentDebt = client.debt || 0;

    return (
        <div className="bg-white min-h-screen flex justify-center items-start pt-2">
            <ThermalStatementReceipt
                client={client}
                transactions={transactions}
                currentDebt={currentDebt}
                isPrintPage={true}
            />
        </div>
    );
}

export default function BatchPrintPage() {
    return (
        <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
            <PrintContent />
        </Suspense>
    );
}
