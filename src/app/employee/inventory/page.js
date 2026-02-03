"use client";
import { useState, useMemo } from "react";
import { useAdminData } from "@/context/AdminDataContext";
import { Search, Filter, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import InventoryBottomSheet from "@/components/inventory/InventoryBottomSheet";
import { db } from "@/lib/firebase";
import { doc, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { notify } from "@/lib/notify";

export default function InventoryHub() {
    const { products, categories, loading } = useAdminData();
    const [selectedCategory, setSelectedCategory] = useState("الكل");
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedProduct, setSelectedProduct] = useState(null);

    // Filter Logic
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesCategory = selectedCategory === "الكل" || p.category === selectedCategory;
            const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [products, selectedCategory, searchTerm]);

    // Handle Save from Bottom Sheet
    const handleSaveInventory = async (newStock, totalValue) => {
        if (!selectedProduct) return;

        try {
            // 1. Archive History
            await addDoc(collection(db, "stock_history"), {
                productId: selectedProduct.id,
                productName: selectedProduct.title,
                oldStock: selectedProduct.stock,
                newStock: newStock,
                totalValue: totalValue,
                performedBy: "Employee", // Todo: Add user context
                date: serverTimestamp()
            });

            // 2. Overwrite Stock
            await updateDoc(doc(db, "product", selectedProduct.id), {
                stock: newStock,
                lastCountDate: serverTimestamp()
            });

            notify.success(`تم تحديث مخزون: ${selectedProduct.title}`);
            setSelectedProduct(null); // Close sheet
        } catch (error) {
            console.error(error);
            notify.error("حدث خطأ أثناء الحفظ");
        }
    };

    if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;

    return (
        <div className="pb-24 bg-slate-50 min-h-screen font-cairo">
            {/* 1. Header & Search */}
            <div className="bg-white p-4 sticky top-0 z-30 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                    <Link href="/employee" className="bg-slate-100 p-2 rounded-full hover:bg-slate-200 transition">
                        <ArrowRight size={20} className="text-slate-600" />
                    </Link>
                    <h1 className="text-xl font-black text-slate-800">جرد المخزون (Stock Valuation)</h1>
                </div>
                <div className="relative">
                    <Search className="absolute right-3 top-3 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="ابحث عن منتج..."
                        className="w-full bg-slate-100 rounded-xl py-3 pr-10 pl-4 font-bold text-sm outline-none focus:ring-2 focus:ring-slate-200"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* 2. Sticky Category Filter */}
            <div className="sticky top-[80px] z-20 bg-slate-50/95 backdrop-blur py-2 px-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-x-auto no-scrollbar flex gap-2">
                <button
                    onClick={() => setSelectedCategory("الكل")}
                    className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${selectedCategory === "الكل" ? "bg-slate-800 text-white shadow-lg shadow-slate-900/20" : "bg-white text-slate-500 border border-slate-200"}`}
                >
                    الكل 📦
                </button>
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.name)}
                        className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${selectedCategory === cat.name ? "bg-slate-800 text-white shadow-lg shadow-slate-900/20" : "bg-white text-slate-500 border border-slate-200"}`}
                    >
                        {cat.name}
                    </button>
                ))}
            </div>

            {/* 3. Product Grid */}
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 animate-fade-in-up">
                {filteredProducts.map(product => (
                    <div
                        key={product.id}
                        onClick={() => setSelectedProduct(product)}
                        className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 active:scale-95 transition-transform cursor-pointer"
                    >
                        <div className="aspect-[4/3] bg-slate-100 relative">
                            <img
                                src={product.img || "https://placehold.co/300"}
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                            {product.stock <= 0 && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                    <span className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-black shadow-lg">نفذت</span>
                                </div>
                            )}
                        </div>
                        <div className="p-3">
                            <h3 className="font-bold text-slate-800 text-sm line-clamp-1 mb-1">{product.title}</h3>
                            <div className="flex justify-between items-end">
                                <span className="text-xs text-slate-400 font-bold">{product.stock} كجم</span>
                                <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-black">{product.price} دج</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Bottom Sheet Integration */}
            <InventoryBottomSheet
                isOpen={!!selectedProduct}
                onClose={() => setSelectedProduct(null)}
                product={selectedProduct}
                onSave={handleSaveInventory}
            />
        </div>
    );
}
