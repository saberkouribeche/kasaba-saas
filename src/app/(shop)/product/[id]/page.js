import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import ProductDetailsClient from "./ProductDetailsClient";

export async function generateMetadata({ params }) {
    const { id } = await params;
    const docRef = doc(db, "product", id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        return { title: `قصابة المسجد | ${snap.data().title}` };
    }
}

export default async function ProductPage({ params }) {
    const { id } = await params;

    // SSR Fetch
    let product = null;
    try {
        const docRef = doc(db, "product", id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            product = { id: snap.id, ...serializeFirestore(snap.data()) };
        }
    } catch (e) {
        console.error("Fetch Error", e);
    }

    if (!product || product.isB2bVisible === true || product.category === 'المطاعم' || (product.visibleToRestaurants && product.visibleToRestaurants.length > 0)) return <div className="text-center py-20 font-bold text-slate-500">المنتج غير موجود أو غير متاح</div>;

    return <ProductDetailsClient product={product} />;
}

// Helper: Recursively serialize Firestore timestamps
function serializeFirestore(data) {
    if (!data) return null;
    if (Array.isArray(data)) {
        return data.map(item => serializeFirestore(item));
    }
    if (typeof data === 'object') {
        // Check for Firestore Timestamp (has toDate method)
        if (typeof data.toDate === 'function') {
            return data.toDate().toISOString();
        }
        // Deep clone and recurse
        const newData = {};
        for (const key in data) {
            newData[key] = serializeFirestore(data[key]);
        }
        return newData;
    }
    return data;
}
