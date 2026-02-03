"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, limit } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { Search, Plus, ShoppingBag, Menu, User, Flame, Drumstick, Utensils, LayoutGrid, Zap } from "lucide-react";

export default function ShopClient({ initialProducts, initialCategories = [], initialBanners = [] }) {
    const [products, setProducts] = useState((initialProducts || []).filter(p => p.isB2bVisible !== true && (!p.visibleToRestaurants || p.visibleToRestaurants.length === 0) && p.category !== 'المطاعم'));
    const [categories, setCategories] = useState([{ name: "الكل", icon: <LayoutGrid size={18} /> }, ...(initialCategories || []).map(cat => ({ name: cat.name, icon: <Utensils size={18} /> }))]);
    const [banners, setBanners] = useState(initialBanners || []);
    const [currBannerIndex, setCurrBannerIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [activeCategory, setActiveCategory] = useState("الكل");
    const [searchTerm, setSearchTerm] = useState("");

    const { user, loading: authLoading } = useAuth(); // getting authLoading
    const { addToCart, cart, setIsDrawerOpen } = useCart();
    const router = useRouter(); // Import useRouter

    // Redirect logic moved to AuthDispatcher
    // useEffect(() => {
    //     if (!authLoading && user?.role === 'restaurant') {
    //         router.replace('/b2b');
    //     }
    // }, [user, authLoading, router]);

    useEffect(() => {
        // Products Realtime
        const q = query(collection(db, "product"), orderBy("category"));
        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Only show non-B2B products in public shop (filter client side for realtime updates too)
            // AND Filter out "Internal" products (showInStore === false)
            setProducts(data.filter(p =>
                p.isB2bVisible !== true &&
                (!p.visibleToRestaurants || p.visibleToRestaurants.length === 0) &&
                p.category !== 'المطاعم' &&
                p.showInStore !== false // Default is true if undefined
            ));
        });

        // Categories Realtime
        const qCat = query(collection(db, "categories"), orderBy("created_at"));
        const unsubCat = onSnapshot(qCat, (snapshot) => {
            const cats = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setCategories([
                { name: "الكل", icon: <LayoutGrid size={18} /> },
                ...cats.map(cat => ({ name: cat.name, icon: <Utensils size={18} /> }))
            ]);
        });

        // Banner Realtime (Top 5)
        const qBanner = query(collection(db, "banner"), orderBy("created_at", "desc"), limit(5));
        const unsubBanner = onSnapshot(qBanner, (snapshot) => {
            if (!snapshot.empty) {
                const b = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setBanners(b);
            } else {
                setBanners([]);
            }
        });

        return () => { unsub(); unsubCat(); unsubBanner(); };
    }, []);

    // Auto Rotation
    useEffect(() => {
        if (banners.length <= 1) return;
        const interval = setInterval(() => {
            setCurrBannerIndex(prev => (prev + 1) % banners.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [banners]);

    const filteredProducts = products.filter(p => {
        // Exclude B2B Products from Customer Shop
        if (p.isB2bVisible === true) return false;

        const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = activeCategory === "الكل" || p.category === activeCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="pb-32 bg-slate-50 min-h-screen">

            {/* === Modern Glass Header === */}
            <header className="sticky top-0 z-40 glass-panel border-b border-white/50 px-4 pt-4 pb-3 rounded-b-3xl shadow-soft">
                <div className="flex justify-between items-center mb-4">
                    <button className="p-2 bg-white rounded-full shadow-sm text-slate-700 hover:bg-slate-100 transition">
                        <Menu size={22} />
                    </button>

                    <div className="text-center">
                        <h1 className="text-2xl font-black text-red-600 tracking-tighter">قصابة المسجد</h1>
                        <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Premium Meat Shop</p>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* B2B Link for Restaurants */}
                        {user?.role === 'restaurant' && (
                            <Link href="/b2b" className="hidden md:flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white rounded-full text-xs font-bold shadow-lg shadow-slate-900/20 hover:scale-105 transition">
                                <Zap size={14} className="fill-yellow-400 text-yellow-400" />
                                طلب سريع
                            </Link>
                        )}

                        <Link href="/track" className="p-2 bg-white rounded-full shadow-sm text-slate-700 hover:bg-slate-100 transition relative">
                            <User size={22} />
                            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></span>
                        </Link>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative group">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <Search className="text-slate-400 group-focus-within:text-red-500 transition" size={20} />
                    </div>
                    <input
                        type="text"
                        className="w-full pl-10 pr-4 py-3.5 bg-slate-100/50 border border-transparent rounded-2xl outline-none focus:bg-white focus:border-red-200 focus:ring-4 focus:ring-red-500/10 transition-all font-bold text-slate-700 text-sm placeholder:text-slate-400"
                        placeholder="ابحث عن منتجك المفضل..."
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </header>

            <div className="px-4 mt-6">
                {/* === Active Categories === */}
                <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                    {categories.map(cat => (
                        <button
                            key={cat.name}
                            onClick={() => setActiveCategory(cat.name)}
                            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap
                ${activeCategory === cat.name
                                    ? "bg-gray-900 text-white shadow-lg shadow-gray-900/20 scale-105"
                                    : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-100 shadow-sm"}`}
                        >
                            {cat.icon}
                            {cat.name}
                        </button>
                    ))}
                </div>

                {/* === Hero Banner (Carousel) - Hidden for Restaurants === */}
                {activeCategory === "الكل" && !searchTerm && banners.length > 0 && user?.role !== 'restaurant' && (
                    <div className="mt-2 mb-8 relative rounded-3xl overflow-hidden shadow-glow h-48 group">
                        {(() => {
                            const banner = banners[currBannerIndex];
                            return banner.link ? (
                                <Link href={banner.link} className="block w-full h-full relative">
                                    <img
                                        src={banner.banner_url || "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?q=80&w=1000&auto=format&fit=crop"}
                                        className="w-full h-full object-cover transition-opacity duration-700"
                                        alt="Banner"
                                    />
                                </Link>
                            ) : (
                                <img
                                    src={banner.banner_url || "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?q=80&w=1000&auto=format&fit=crop"}
                                    className="w-full h-full object-cover transition-opacity duration-700"
                                    alt="Banner"
                                />
                            );
                        })()}

                        {/* Dots Indicators */}
                        {banners.length > 1 && (
                            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2 z-10">
                                {banners.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrBannerIndex(idx)}
                                        className={`w-2 h-2 rounded-full transition-all ${idx === currBannerIndex ? "bg-white w-6" : "bg-white/50 hover:bg-white"}`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* === Product Grid === */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-slate-800">
                        {activeCategory === "الكل" ? "جميع المنتجات" : activeCategory}
                    </h3>
                    <span className="text-slate-400 text-sm font-medium">{filteredProducts.length} منتج</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {loading ? (
                        [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
                    ) : filteredProducts.length === 0 ? (
                        <EmptyState />
                    ) : (
                        filteredProducts.map(product => (
                            <ModernProductCard key={product.id} product={product} addToCart={addToCart} />
                        ))
                    )}
                </div>
            </div>


        </div>
    );
}

// === Sub Components ===

import Image from "next/image";

function ModernProductCard({ product, addToCart }) {
    const router = useRouter();
    // Navigate to details page on click
    const handleCardClick = () => {
        router.push(`/product/${product.id}`);
    };

    return (
        <div
            onClick={handleCardClick}
            className="bg-white p-3 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-3 group hover:shadow-lg hover:shadow-red-500/5 transition-all duration-300 cursor-pointer active:scale-95"
        >
            <div className="w-full aspect-square bg-slate-50 rounded-2xl overflow-hidden relative isolate">
                <Image
                    src={product.img || "https://placehold.co/400x400/png?text=Meat"}
                    alt={product.title}
                    fill
                    sizes="(max-width: 768px) 50vw, 33vw"
                    className="object-cover transition duration-500 group-hover:scale-110"
                />

                {product.stock <= 0 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-sm backdrop-blur-sm z-10">
                        نفذت الكمية
                    </div>
                )}
            </div>

            <div className="space-y-1">
                <h3 className="font-bold text-slate-800 text-sm line-clamp-1">{product.title}</h3>
                <div className="flex items-end justify-between">
                    <p className="text-red-600 font-black text-lg">{product.price} <span className="text-xs font-medium text-slate-400">دج</span></p>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">1 كجم</span>
                </div>
            </div>

            {/* Visual Indicator for "Add" (Fake Button) */}
            <button
                className="w-full py-3 rounded-xl font-bold text-sm bg-red-600 text-white shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2 hover:bg-red-700"
            >
                {product.stock > 0 ? "طلب / تخصيص" : "نفذت"}
            </button>
        </div>
    );
}

function SkeletonCard() {
    return (
        <div className="bg-white rounded-3xl p-3 h-72 animate-pulse border border-slate-100">
            <div className="w-full h-40 bg-slate-100 rounded-2xl mb-4"></div>
            <div className="h-4 bg-slate-100 rounded-full w-3/4 mb-2"></div>
            <div className="h-4 bg-slate-100 rounded-full w-1/2"></div>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="col-span-2 flex flex-col items-center justify-center py-12 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Search className="text-slate-300" size={32} />
            </div>
            <h3 className="font-bold text-slate-700">لا توجد نتائج</h3>
            <p className="text-slate-400 text-sm">جرب البحث عن منتج آخر</p>
        </div>
    );
}
