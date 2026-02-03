"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { X, Plus, Trash2, Save, ShoppingCart, AlertCircle, Search, ChevronUp, ChevronDown, Check } from "lucide-react";
import { useAdminData } from "@/context/AdminDataContext";
import { notify } from "@/lib/notify";
import { addDoc, collection, serverTimestamp, updateDoc, doc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatPrice } from "@/lib/formatters";

export default function AddSupplierTransactionModal({ isOpen, onClose, supplier, onSuccess }) {
    const { products } = useAdminData();
    const [loading, setLoading] = useState(false);

    // Form State
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
    const [note, setNote] = useState("");
    const [items, setItems] = useState([]);

    // Interaction State
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedProduct, setSelectedProduct] = useState(null); // Triggers Bottom Sheet
    const [cartOpen, setCartOpen] = useState(false); // Triggers Cart Drawer

    // Input Sheet State
    const [inputQty, setInputQty] = useState("");
    const [inputCost, setInputCost] = useState("");
    const qtyInputRef = useRef(null);

    // Filter products
    const supplierProducts = useMemo(() => {
        if (!supplier) return [];
        return products.filter(p => {
            const matchesSupplier = p.supplierId === supplier.id;
            const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSupplier && matchesSearch;
        });
    }, [products, supplier, searchTerm]);

    // Focus input when sheet opens
    useEffect(() => {
        if (selectedProduct && qtyInputRef.current) {
            setTimeout(() => qtyInputRef.current.focus(), 150);
        }
    }, [selectedProduct]);

    if (!isOpen || !supplier) return null;

    // --- Calculations ---
    const calculateTotal = (qty, cost) => (Number(qty) || 0) * (Number(cost) || 0);
    const invoiceTotal = items.reduce((sum, item) => sum + item.total, 0);

    // --- Actions ---
    const handleProductClick = (product) => {
        // Pre-fill if already in cart (edit mode logic could go here, for now just add new or overwrite?)
        // Let's assume add/update mode. if exists, prefill.
        const existing = items.find(i => i.productId === product.id);
        setInputQty(existing ? existing.qty : "");
        setInputCost(existing ? existing.cost : (product.costPrice || ""));
        setSelectedProduct(product);
    };

    const handleSheetClose = () => {
        setSelectedProduct(null);
        setInputQty("");
        setInputCost("");
    };

    const addToCart = () => {
        if (!inputQty || Number(inputQty) <= 0) return notify.error("الرجاء إدخال الكمية");

        const newItem = {
            productId: selectedProduct.id,
            productName: selectedProduct.title,
            qty: Number(inputQty),
            cost: Number(inputCost),
            total: calculateTotal(inputQty, inputCost)
        };

        setItems(prev => {
            const existingIdx = prev.findIndex(i => i.productId === newItem.productId);
            if (existingIdx >= 0) {
                const updated = [...prev];
                updated[existingIdx] = newItem;
                return updated;
            }
            return [...prev, newItem];
        });

        notify.success("تمت الإضافة للسلة");
        handleSheetClose();
    };

    const handleRemoveItem = (id) => {
        setItems(prev => prev.filter(i => i.productId !== id));
    };

    const handleSubmit = async () => {
        if (items.length === 0) return notify.error("السلة فارغة");
        setLoading(true);
        try {
            let finalNote = note;
            if (!finalNote) {
                const itemSummary = items.map(i => `${i.productName} (${i.qty})`).join("، ");
                finalNote = `مشتريات: ${itemSummary}`;
            }

            const txData = {
                type: 'invoice',
                amount: invoiceTotal,
                note: finalNote,
                items,
                date: transactionDate,
                createdAt: serverTimestamp()
            };

            await addDoc(collection(db, `suppliers/${supplier.id}/transactions`), txData);
            await updateDoc(doc(db, "suppliers", supplier.id), {
                debt: increment(invoiceTotal),
                lastTransactionDate: serverTimestamp()
            });

            notify.success("تم تسجيل الفاتورة بنجاح");
            setItems([]);
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            notify.error("حدث خطأ");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[150] bg-slate-100 flex flex-col animate-in fade-in duration-200">

            {/* 1. Header & Search (Sticky) */}
            <div className="bg-white shadow-sm px-4 py-3 sticky top-0 z-20">
                <div className="flex justify-between items-center mb-3">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">فاتورة جديدة</h2>
                        <p className="text-sm font-bold text-slate-400">{supplier.name}</p>
                    </div>
                    <button onClick={onClose} className="bg-slate-50 p-2 rounded-full text-slate-400 hover:bg-slate-100"><X size={24} /></button>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute right-3 top-3 text-slate-400" size={20} />
                    <input
                        className="w-full bg-slate-50 rounded-2xl py-3 pr-10 pl-4 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        placeholder="ابحث عن منتج..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* 2. Visual Grid (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4 pb-32">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {supplierProducts.map(product => {
                        const inCart = items.find(i => i.productId === product.id);
                        return (
                            <div
                                key={product.id}
                                onClick={() => handleProductClick(product)}
                                className={`relative group overflow-hidden bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 active:scale-95 transition-all duration-200 cursor-pointer ${inCart ? 'ring-2 ring-emerald-500' : ''}`}
                            >
                                {/* Image Area */}
                                <div className="aspect-[4/3] w-full bg-gray-100 relative">
                                    <img src={product.img || "https://placehold.co/300"} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />

                                    {/* Price Badge */}
                                    <div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur px-3 py-1 rounded-full text-xs font-black shadow-sm text-slate-800">
                                        {formatPrice(product.costPrice || 0)}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-3 text-center">
                                    <h3 className="font-bold text-slate-800 text-sm line-clamp-1">{product.title}</h3>
                                    {inCart && (
                                        <div className="mt-2 bg-emerald-100 text-emerald-700 py-1 px-3 rounded-full text-[10px] font-black animate-pulse flex items-center justify-center gap-1">
                                            <Check size={10} /> {inCart.qty} أضيف
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                {supplierProducts.length === 0 && (
                    <div className="text-center py-20 opacity-50 font-bold">
                        <p>لا توجد منتجات مطابقة لهذا المورد</p>
                    </div>
                )}
            </div>

            {/* 3. Floating Bottom Cart Bar */}
            <div className={`fixed bottom-0 left-0 right-0 z-30 transition-transform duration-300 ${cartOpen ? 'translate-y-full' : 'translate-y-0'}`}>
                <div className="bg-white/90 backdrop-blur-md border-t border-gray-200 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] p-4">
                    <div
                        onClick={() => setCartOpen(true)}
                        className="flex items-center justify-between mb-3 cursor-pointer active:opacity-70"
                    >
                        <div className="flex items-center gap-2">
                            <div className="bg-emerald-100 text-emerald-600 p-2 rounded-xl">
                                <ChevronUp size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500">المجموع ({items.length} منتجات)</p>
                                <p className="text-2xl font-black text-slate-900">{formatPrice(invoiceTotal)}</p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={items.length === 0 || loading}
                        className="w-full bg-slate-900 text-white h-14 rounded-xl shadow-lg shadow-slate-900/20 font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'جاري الحفظ...' : <span>تأكيد الفاتورة <Check size={20} className="inline" /></span>}
                    </button>
                </div>
            </div>

            {/* 4. Cart Drawer (Expandable) */}
            {cartOpen && (
                <div className="fixed inset-0 z-[40] flex flex-col justify-end">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
                    <div className="bg-white w-full rounded-t-[32px] shadow-2xl p-6 relative animate-slide-up max-h-[80vh] flex flex-col">
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />

                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black text-slate-800">سلة المشتريات</h3>
                            <button onClick={() => setCartOpen(false)} className="bg-slate-50 p-2 rounded-full"><ChevronDown /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 mb-6">
                            {items.length === 0 && <p className="text-center text-slate-400 font-bold py-10">السلة فارغة</p>}
                            {items.map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{item.productName}</p>
                                        <p className="text-xs font-bold text-slate-400 mt-1">
                                            {item.qty} × {formatPrice(item.cost)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <p className="font-black text-slate-800 dir-ltr">{formatPrice(item.total)}</p>
                                        <button onClick={() => handleRemoveItem(item.productId)} className="text-red-400 hover:text-red-600 bg-white p-2 rounded-xl shadow-sm"><Trash2 size={18} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-slate-100 pt-4">
                            <div className="flex justify-between items-center mb-4">
                                <span className="font-bold text-slate-500">الإجمالي النهائي</span>
                                <span className="font-black text-3xl text-emerald-600">{formatPrice(invoiceTotal)}</span>
                            </div>
                            <button
                                onClick={handleSubmit}
                                disabled={items.length === 0 || loading}
                                className="w-full bg-emerald-600 text-white h-14 rounded-2xl font-black text-lg shadow-lg shadow-emerald-500/30"
                            >
                                حفظ الفاتورة
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 5. Input Sheet (Thumb Friendly) */}
            {selectedProduct && (
                <div className="fixed inset-0 z-[50] flex flex-col justify-end">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleSheetClose} />
                    <div className="bg-white w-full rounded-t-[32px] shadow-2xl p-6 relative animate-slide-up">
                        <div className="flex gap-4 mb-6">
                            <img src={selectedProduct.img || "https://placehold.co/100"} className="w-20 h-20 rounded-2xl object-cover bg-slate-100" />
                            <div>
                                <h3 className="text-lg font-black text-slate-800 line-clamp-2">{selectedProduct.title}</h3>
                                <p className="text-sm font-bold text-slate-400 mt-1">سعر التكلفة الافتراضي: {selectedProduct.costPrice || 0}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2">الكمية / الوزن</label>
                                <input
                                    ref={qtyInputRef}
                                    type="number"
                                    className="w-full h-16 bg-slate-50 rounded-2xl text-center text-3xl font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all outline-none"
                                    placeholder="0"
                                    value={inputQty}
                                    onChange={e => setInputQty(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2">سعر الشراء (دج)</label>
                                <input
                                    type="number"
                                    className="w-full h-16 bg-slate-50 rounded-2xl text-center text-3xl font-black text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                                    placeholder={selectedProduct.costPrice || "0"}
                                    value={inputCost}
                                    onChange={e => setInputCost(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            onClick={addToCart}
                            className="w-full bg-slate-900 text-white h-14 rounded-2xl font-black text-lg shadow-xl shadow-slate-900/20 active:scale-95 transition-transform"
                        >
                            إضافة للسلة
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}
