"use client";
import { useState, useEffect } from "react";
import { X, Search, Plus, Check, Trash2, Package } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs, updateDoc, doc, query, orderBy } from "firebase/firestore";
import { notify } from "@/lib/notify";

export default function ManageRestaurantProductsModal({ isOpen, onClose, client }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [processing, setProcessing] = useState(null); // id of product being processed

    useEffect(() => {
        if (isOpen && client) {
            fetchProducts();
        }
    }, [isOpen, client]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "product"), orderBy("title"));
            const snapshot = await getDocs(q);
            const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setProducts(list);
        } catch (error) {
            console.error("Error fetching products:", error);
            notify.error("فشل في جلب المنتجات");
        } finally {
            setLoading(false);
        }
    };

    const handleToggleProduct = async (product) => {
        if (!client || !client.id) return;
        setProcessing(product.id);

        const isAssigned = product.restaurantPricing && product.restaurantPricing[client.id] !== undefined;

        try {
            const productRef = doc(db, "product", product.id);
            let updates = {};

            if (isAssigned) {
                // Remove (Unassign)
                // Note: Firestore update for nested map field deletion uses FieldValue.delete() but for map keys we might need trickery or read-modify-write.
                // Simpler: Read, delete key, write.
                const newPricing = { ...product.restaurantPricing };
                delete newPricing[client.id];

                // If visibleToRestaurants array exists, remove as well (legacy compatibility)
                let newVisible = product.visibleToRestaurants || [];
                if (Array.isArray(newVisible)) {
                    newVisible = newVisible.filter(phone => phone !== client.phone);
                }

                updates = {
                    restaurantPricing: newPricing,
                    visibleToRestaurants: newVisible
                };
            } else {
                // Add (Assign)
                const price = product.price || 0; // Default to base price
                const newPricing = { ...(product.restaurantPricing || {}) };
                newPricing[client.id] = Number(price);

                let newVisible = product.visibleToRestaurants || [];
                if (client.phone && !newVisible.includes(client.phone)) {
                    newVisible.push(client.phone);
                }

                updates = {
                    restaurantPricing: newPricing,
                    visibleToRestaurants: newVisible
                };
            }

            await updateDoc(productRef, updates);

            // Update local state
            setProducts(prev => prev.map(p => {
                if (p.id === product.id) {
                    return { ...p, ...updates };
                }
                return p;
            }));

            notify.success(isAssigned ? "تم إزالة المنتج" : "تم تعيين المنتج");

        } catch (error) {
            console.error("Error updating product:", error);
            notify.error("حدث خطأ");
        } finally {
            setProcessing(null);
        }
    };

    // Helper to update price directly
    const handlePriceChange = async (product, newPrice) => {
        if (!client || !client.id) return;

        try {
            const productRef = doc(db, "product", product.id);
            const newPricing = { ...(product.restaurantPricing || {}) };
            newPricing[client.id] = Number(newPrice);

            await updateDoc(productRef, { restaurantPricing: newPricing });

            setProducts(prev => prev.map(p => {
                if (p.id === product.id) {
                    return { ...p, restaurantPricing: newPricing };
                }
                return p;
            }));
            notify.success("تم تحديث السعر");
        } catch (e) {
            notify.error("فشل تحديث السعر");
        }
    };

    if (!isOpen) return null;

    const filtered = products.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">

                {/* Header */}
                <div className="bg-slate-900 px-6 py-5 flex justify-between items-center text-white shrink-0">
                    <div>
                        <h3 className="text-xl font-black">إدارة منتجات المطعم</h3>
                        <p className="text-xs text-slate-400 font-bold mt-1">{client.fullName || client.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 bg-slate-50 border-b border-slate-100">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="ابحث عن منتج لإضافته أو تعديله..."
                            className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-200 focus:border-blue-500 outline-none font-bold text-slate-700 shadow-sm"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <Search className="absolute right-3 top-3 text-slate-400" size={20} />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/50">
                    {loading ? (
                        <div className="text-center py-20 text-slate-400 font-bold">جاري تحميل المنتجات...</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {filtered.map(product => {
                                const isAssigned = product.restaurantPricing && product.restaurantPricing[client.id] !== undefined;
                                const assignedPrice = isAssigned ? product.restaurantPricing[client.id] : product.price;

                                return (
                                    <div key={product.id} className={`bg-white p-3 rounded-2xl border transition-all relative group ${isAssigned ? 'border-blue-500 shadow-md ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300'}`}>
                                        <div className="flex gap-3 mb-3">
                                            <div className="w-12 h-12 bg-slate-100 rounded-lg flex-shrink-0 overflow-hidden">
                                                {product.img ? (
                                                    <img src={product.img} className="w-full h-full object-cover" alt="" />
                                                ) : <div className="w-full h-full flex items-center justify-center text-slate-300"><Package size={20} /></div>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-slate-800 text-sm truncate" title={product.title}>{product.title}</h4>
                                                <p className="text-xs text-slate-500 font-medium">الأساسي: {Number(product.price).toLocaleString()}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {isAssigned ? (
                                                <div className="flex-1 flex gap-1">
                                                    <input
                                                        type="number"
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-center font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                        defaultValue={assignedPrice}
                                                        onBlur={(e) => {
                                                            const val = Number(e.target.value);
                                                            if (val !== assignedPrice) handlePriceChange(product, val);
                                                        }}
                                                    />
                                                    <button
                                                        onClick={() => handleToggleProduct(product)}
                                                        disabled={processing === product.id}
                                                        className="bg-red-50 text-red-500 hover:bg-red-100 p-2 rounded-lg transition"
                                                        title="إزالة من القائمة"
                                                    >
                                                        {processing === product.id ? "..." : <Trash2 size={16} />}
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleToggleProduct(product)}
                                                    disabled={processing === product.id}
                                                    className="w-full bg-slate-100 text-slate-600 hover:bg-blue-600 hover:text-white py-2 rounded-lg font-bold text-xs transition flex items-center justify-center gap-2"
                                                >
                                                    {processing === product.id ? "جاري الإضافة..." : <><Plus size={14} /> إضافة للقائمة</>}
                                                </button>
                                            )}
                                        </div>

                                        {isAssigned && <div className="absolute top-2 left-2 bg-blue-500 text-white rounded-full p-0.5 shadow-sm"><Check size={10} /></div>}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
