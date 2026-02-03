import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, limit } from "firebase/firestore";
import AuthDispatcher from "@/components/AuthDispatcher";

// Force dynamic to ensure fresh data and immediate filtering results
export const dynamic = 'force-dynamic';

export default async function ShopPage({ searchParams }) {
  // SSR Fetch
  let products = [];
  let categories = [];
  let banners = [];

  // Await searchParams for Next.js 15 compat (safe for 14 too if checking)
  const params = await searchParams;
  const isB2BMode = params?.b2b_mode === 'true';

  try {
    // 1. Fetch Products
    const qProducts = query(collection(db, "product"), orderBy("category"));
    const snapshotProducts = await getDocs(qProducts);
    products = snapshotProducts.docs.map(doc => ({
      id: doc.id,
      ...serializeFirestore(doc.data())
    })).filter(p => p.isB2bVisible !== true && (!p.visibleToRestaurants || p.visibleToRestaurants.length === 0) && p.category !== 'المطاعم');

    // 2. Fetch Categories
    const qCategories = query(collection(db, "categories"), orderBy("created_at"));
    const snapshotCategories = await getDocs(qCategories);
    categories = snapshotCategories.docs.map(doc => ({
      id: doc.id,
      ...serializeFirestore(doc.data())
    }));

    // 3. Fetch Active Banners (Latest 5)
    const qBanners = query(collection(db, "banner"), orderBy("created_at", "desc"), limit(5));
    const snapshotBanners = await getDocs(qBanners);
    banners = snapshotBanners.docs.map(doc => ({
      id: doc.id,
      ...serializeFirestore(doc.data())
    }));

  } catch (error) {
    console.error("Failed to fetch data for SSR:", error);
  }

  return (
    <AuthDispatcher
      initialProducts={products}
      initialCategories={categories}
      initialBanners={banners}
      isB2BMode={isB2BMode}
    />
  );
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
