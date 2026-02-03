"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, doc } from "firebase/firestore";
import { Search, ShoppingCart, Loader2, Zap, ArrowRight, CheckCircle2, FileText, Wallet, ChevronRight } from "lucide-react";
import { notify } from "@/lib/notify";
import StatementModal from "@/components/admin/StatementModal";
import { useClientLedger } from "@/hooks/useClientLedger";

import SplashScreen from "@/components/SplashScreen";

export default function OrderSheetClient() {
    const { user: authUser, loading: authLoading } = useAuth();
    const router = useRouter();
    const { addToCart, setIsDrawerOpen } = useCart();
    const [user, setUser] = useState(authUser); // Local user state for real-time updates
    const { balance: ledgerBalance, loading: ledgerLoading } = useClientLedger(user);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    // Sync authUser to local user initially and listen for updates
    useEffect(() => {
        if (!authUser?.phone) return;

        const unsub = onSnapshot(doc(db, "users", authUser.phone), (doc) => {
            if (doc.exists()) {
                setUser({ ...authUser, ...doc.data() });
            }
        });
        return () => unsub();
    }, [authUser]);
    const [searchTerm, setSearchTerm] = useState("");
    const [quantities, setQuantities] = useState({}); // Map { productId: quantity }
    const [isStatementOpen, setIsStatementOpen] = useState(false);

    // Safety Timeout for Loading
    useEffect(() => {
        const timer = setTimeout(() => {
            if (loading) setLoading(false);
        }, 3000);
        return () => clearTimeout(timer);
    }, [loading]);

    // Fetch B2B Products
    useEffect(() => {
        const q = query(
            collection(db, "product"),
            // where("isB2bVisible", "==", true), // Optional: Filter server-side or client-side if index missing
            orderBy("category")
        );

        const unsub = onSnapshot(q, (snapshot) => {
            let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Filter client-side to be safe if index is deploying
            // Filter client-side
            data = data.filter(p => {
                // 1. Must be B2B visible
                if (p.isB2bVisible !== true) return false;

                // 2. Check for Restaurant Restriction
                if (p.visibleToRestaurants && p.visibleToRestaurants.length > 0) {
                    // authUser might be stale, use local user state if available, but for filter inside effect, better use authUser ref or assume stability.
                    // IMPORTANT: authUser is from context, usually stable. 
                    if (!authUser?.phone) return false;
                    return p.visibleToRestaurants.includes(authUser.phone);
                }

                return true;
            });
            setProducts(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching products:", error);
            setLoading(false);
        });

        return () => unsub();
    }, [authUser]);

    // Helper: Get Price for User
    const getPrice = (product) => {
        if (!user) return product.price;

        // 1. Restaurant Specific Price
        if (product.restaurantPricing && product.restaurantPricing[user.phone]) {
            return Number(product.restaurantPricing[user.phone]);
        }

        // 2. Tier Price
        if (user.priceTier && product.pricingTiers?.[user.priceTier]) {
            const tierPrice = product.pricingTiers[user.priceTier];
            return tierPrice ? Number(tierPrice) : product.price;
        }

        // 3. Default
        return product.price;
    };

    // Helper: Handle Quantity Change
    const handleQtyChange = (id, val) => {
        setQuantities(prev => ({ ...prev, [id]: val }));
    };

    // Helper: Add Item
    const handleAdd = (product) => {
        const qty = Number(quantities[product.id] || 0);
        if (qty <= 0) {
            notify.error("الكمية يجب أن تكون أكبر من 0");
            return;
        }

        // 1. Resolve Price
        const finalPrice = getPrice(product);
        const productToAdd = { ...product, price: finalPrice };

        // 2. Add to Cart (Don't open drawer every time for speed)
        addToCart(productToAdd, qty, null, false);

        // 3. Feedback
        notify.success(`تم إضافة ${product.title}`);
        setQuantities(prev => ({ ...prev, [product.id]: "" }));
    };

    // Filter
    const filtered = products.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase()));

    // Group by Category
    const grouped = filtered.reduce((acc, product) => {
        const cat = product.category || "أخرى";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(product);
        return acc;
    }, {});

    if (authLoading || loading) {
        return (
            <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center">
                <div className="relative w-32 h-32 mb-8 animate-pulse">
                    <div className="absolute inset-0 bg-red-100 rounded-full animate-ping opacity-20"></div>
                    <div className="relative bg-white p-6 rounded-full shadow-xl shadow-red-100 border border-red-50 flex items-center justify-center h-full w-full">
                        <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                </div>
                <Loader2 className="animate-spin text-slate-400 mb-4" size={32} />
                <p className="text-slate-400 font-bold tracking-widest text-sm animate-pulse">JARI TAHMIL...</p>
            </div>
        );
    }

    if (!user || user.role !== 'restaurant') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
                <h2 className="text-2xl font-black text-slate-800 mb-2">وصول مقيد 🔒</h2>
                <p className="text-slate-500 mb-6">هذه الصفحة مخصصة لعملاء الجملة والمطاعم فقط.</p>
                <a href="/shop" className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-red-700 transition">
                    <ArrowRight size={20} /> العودة للمتجر
                </a>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-32">
            {/* Premium Header */}
            <header className="bg-slate-900 sticky top-0 z-30 shadow-2xl">
                {/* Top Bar: User & Status */}
                <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/b2b/dashboard')}
                            className="bg-white/10 p-2 rounded-xl backdrop-blur-sm text-white hover:bg-white/20 transition active:scale-95"
                        >
                            <ChevronRight size={20} />
                        </button>
                        <div className="bg-white/10 p-2 rounded-xl backdrop-blur-sm">
                            <Zap className="text-yellow-400 fill-yellow-400" size={20} />
                        </div>
                        <div>
                            <h1 className="text-white font-black text-lg leading-tight">منصة المطاعم</h1>
                            <p className="text-slate-400 text-xs font-bold">{user.fullName}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Debt Widget (Compact) */}
                        <div className={`px-4 py-1.5 rounded-lg border ${ledgerBalance > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-green-500/10 border-green-500/20'} flex flex-col items-center`}>
                            <span className={`text-[10px] font-bold ${ledgerBalance > 0 ? 'text-red-400' : 'text-green-400'}`}>الديون</span>
                            <span className={`text-sm font-black ${ledgerBalance > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {(ledgerBalance || 0).toLocaleString()} <span className="text-[10px]">DA</span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Action Bar: Search & Tools */}
                <div className="px-4 py-3 gap-3 flex items-center">
                    <div className="relative flex-1">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            autoFocus
                            type="text"
                            placeholder="بحث سريع..."
                            className="w-full pl-4 pr-10 py-3 bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl font-bold outline-none focus:border-yellow-500 transition shadow-inner"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-2">
                        {/* Statement Button Removed */}

                        <button
                            onClick={() => setIsDrawerOpen(true)}
                            className="h-12 w-12 flex items-center justify-center bg-yellow-400 text-slate-900 rounded-xl shadow-lg shadow-yellow-400/20 hover:bg-yellow-300 transition relative"
                        >
                            <ShoppingCart size={22} className="fill-slate-900" />
                            {Object.keys(quantities).length > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-yellow-400"></span>}
                        </button>
                    </div>
                </div>
            </header>

            {/* List */}
            <div className="max-w-4xl mx-auto p-4 space-y-8">
                {loading && (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Loader2 className="animate-spin mb-4" size={40} />
                        <span className="font-bold">جاري تحميل المنتجات...</span>
                    </div>
                )}

                {!loading && Object.keys(grouped).length === 0 && (
                    <div className="text-center py-12 text-slate-400 font-bold">لا توجد منتجات مطابقة</div>
                )}

                {!loading && Object.entries(grouped).map(([category, items]) => (
                    <div key={category} className="animate-fade-in">
                        <h3 className="text-lg font-black text-slate-800 mb-4 px-2 flex items-center gap-2">
                            <div className="w-1.5 h-6 bg-red-600 rounded-full"></div>
                            {category}
                        </h3>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {items.map(product => {
                                const price = getPrice(product);
                                const qty = quantities[product.id] || "";

                                return (
                                    <div key={product.id} className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden flex flex-col group active:scale-95 transition-all duration-200">
                                        {/* Image Area */}
                                        <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden">
                                            <img
                                                src={product.img || "https://placehold.co/300"}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                alt={product.title}
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-60" />

                                            {/* Price Badge */}
                                            <div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur px-3 py-1.5 rounded-xl text-sm font-black text-slate-900 shadow-lg">
                                                {price.toLocaleString()} <span className="text-[10px] text-slate-500">دج</span>
                                            </div>

                                            {product.stock < 10 && (
                                                <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-sm animate-pulse">
                                                    بقي {product.stock}
                                                </div>
                                            )}
                                        </div>

                                        {/* Content Area */}
                                        <div className="p-3 flex flex-col gap-3 flex-1">
                                            <h4 className="font-bold text-slate-800 text-sm line-clamp-2 leading-snug min-h-[2.5rem]">
                                                {product.title}
                                            </h4>

                                            {/* Action Bar */}
                                            <div className="mt-auto flex gap-2">
                                                <input
                                                    type="number"
                                                    className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-2 text-center font-bold text-lg outline-none focus:border-red-500 focus:bg-white transition-colors ${qty ? 'border-red-200 bg-red-50 text-red-600' : 'text-slate-800'}`}
                                                    placeholder="0"
                                                    value={qty}
                                                    onChange={e => handleQtyChange(product.id, e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleAdd(product);
                                                    }}
                                                />
                                                <button
                                                    onClick={() => handleAdd(product)}
                                                    className="w-12 h-12 flex-shrink-0 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg shadow-slate-900/20 active:scale-90 hover:bg-red-600 transition-colors"
                                                >
                                                    <span className="font-bold text-xl">+</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Statement Modal */}
            <StatementModal
                isOpen={isStatementOpen}
                onClose={() => setIsStatementOpen(false)}
                client={user} // Pass logged in user as client
            />
        </div>
    );
}
