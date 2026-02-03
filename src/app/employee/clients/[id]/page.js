"use client";
import { use, useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import UnifiedPOS from "@/components/pos/UnifiedPOS";

export default function ClientPOSPage({ params }) {
    const { id } = use(params);
    const [client, setClient] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchClient = async () => {
            try {
                const snapshot = await getDoc(doc(db, 'users', id));
                if (snapshot.exists()) {
                    setClient({ id: snapshot.id, ...snapshot.data() });
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchClient();
    }, [id]);

    if (loading) return <div className="h-screen flex items-center justify-center font-bold text-slate-400">جاري تحميل بيانات الزبون...</div>;
    if (!client) return <div className="h-screen flex items-center justify-center font-bold text-slate-400">الزبون غير موجود</div>;

    return <UnifiedPOS entity={client} type="CLIENT" />;
}
