"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, doc, increment, serverTimestamp } from "firebase/firestore";
import { notify } from "@/lib/notify";
import { Search, ShoppingCart, Trash2, Check, ArrowRight, Store, Scale, Grid, Plus, X } from "lucide-react";
import { formatPrice } from "@/lib/formatters";
import { useRouter } from "next/navigation";

export default function UnifiedPOS({ entity, type, onBack }) {
    // type: 'SUPPLIER' | 'CLIENT'
    const isSupplier = type === 'SUPPLIER';
    const THEME = isSupplier ? 'blue' : 'orange';
    const router = useRouter();

    const [activeTab, setActiveTab] = useState('grid'); // 'grid' | 'weight'

    // --- SHARED DATA ---
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- CART STATE ---
    const [cart, setCart] = useState([]);
    const [cartOpen, setCartOpen] = useState(false);
    const cartStorageKey = useMemo(() => `pos_cart_${type}_${entity.id}`, [type, entity]);

    // Load Cart
    useEffect(() => {
        const saved = localStorage.getItem(cartStorageKey);
        if (saved) {
            try {
                setCart(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse cart", e);
            }
        }
    }, [cartStorageKey]);

    // Save Cart
    useEffect(() => {
        localStorage.setItem(cartStorageKey, JSON.stringify(cart));
    }, [cart, cartStorageKey]);

    // --- GRID STATE ---
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [inputQty, setInputQty] = useState("");
    const [inputPrice, setInputPrice] = useState(""); // Cost or Sales Price
    const qtyInputRef = useRef(null);

    // ... (rest of code before actions)

    // --- ACTIONS: GRID ---
    const handleProductClick = (product) => {
        // Do NOT auto-fill from previous entry since we want duplicate entries capability unless explicitly desired otherwise.
        // User requested: "choose product write quantity press add then re-choose same product choose quantity"
        // So we treat every addition as new. Default price logic remains.

        let defaultPrice = "";
        if (isSupplier) {
            defaultPrice = product.costPrice || "";
        } else {
            const specialPrice = product.restaurantPricing?.[entity.id];
            defaultPrice = specialPrice || product.price || "";
        }

        setInputQty("");
        setInputPrice(defaultPrice);
        setSelectedProduct(product);

        setTimeout(() => {
            if (qtyInputRef.current) qtyInputRef.current.focus();
        }, 150);
    };

    const addToCart = () => {
        if (!inputQty || Number(inputQty) <= 0) return notify.error("الرجاء إدخال الكمية");

        const price = Number(inputPrice) || 0;
        const qty = Number(inputQty);

        const newItem = {
            uniqueId: Date.now() + Math.random(), // Unique ID for separate line items
            id: selectedProduct.id,
            title: selectedProduct.title,
            qty: qty,
            price: price,
            total: qty * price
        };

        setCart(prev => [...prev, newItem]);

        notify.success("تمت الإضافة");
        setSelectedProduct(null);
        setInputQty("");
        setInputPrice("");
    };

    const removeFromCart = (uniqueId) => setCart(prev => prev.filter(i => i.uniqueId !== uniqueId));

    // --- ACTIONS: WEIGHT ---
    const handleAddBatch = (groupId) => {
        setGroups(prev => prev.map(g => {
            if (g.id === groupId && parseFloat(g.currentBatch) > 0) {
                return { ...g, batches: [...g.batches, parseFloat(g.currentBatch)], currentBatch: '' };
            }
            return g;
        }));
    };

    const updateGroup = (id, field, val) => {
        setGroups(prev => prev.map(g => g.id === id ? { ...g, [field]: val } : g));
    };

    // --- CHECKOUT STATE ---
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [checkoutDate, setCheckoutDate] = useState(""); // ISO String
    const [checkoutPaidAmount, setCheckoutPaidAmount] = useState(""); // Partial Payment

    // Initialize date to now on mount
    useEffect(() => setCheckoutDate(new Date().toISOString().slice(0, 16)), []);

    // --- SUBMIT ---
    const handleInitialSubmit = () => {
        const finalTotal = Math.round(totalAmount);
        if (finalTotal <= 0) return notify.error("القيمة الإجمالية 0");
        setIsCheckoutOpen(true);
    };

    const handleFinalSubmit = async () => {
        const finalTotal = Math.round(totalAmount);
        const paid = Number(checkoutPaidAmount) || 0;

        try {
            setIsCheckoutOpen(false);

            // 1. Prepare Timestamp
            const { Timestamp } = await import("firebase/firestore"); // Import explicitly if needed or use new Date(checkoutDate)
            const selectedDate = checkoutDate ? new Date(checkoutDate) : new Date();
            // Firestore timestamp
            const finalTimestamp = Timestamp.fromDate(selectedDate);

            // 2. Base Transaction Processing
            if (isSupplier) {
                // --- SUPPLIER LOGIC ---
                // A. Create Invoice
                const txData = {
                    type: 'invoice',
                    amount: finalTotal,
                    note: activeTab === 'weight' ? 'فاتورة وزن (مؤرخة)' : 'فاتورة مواد (مؤرخة)',
                    details: activeTab === 'weight' ? { system: 'weight_multi', groups } : { system: 'grid', items: cart },
                    items: activeTab === 'grid' ? cart.map(i => ({ productId: i.id, productName: i.title, qty: i.qty, cost: i.price, total: i.total })) : [],
                    createdAt: finalTimestamp
                };

                await addDoc(collection(db, `suppliers/${entity.id}/transactions`), txData);
                await updateDoc(doc(db, 'suppliers', entity.id), {
                    debt: increment(finalTotal),
                    lastTransactionDate: finalTimestamp
                });

                // B. Handle Payment (If any)
                if (paid > 0) {
                    await addDoc(collection(db, `suppliers/${entity.id}/transactions`), {
                        type: 'payment',
                        amount: paid,
                        note: 'دفعة فورية مع الفاتورة',
                        createdAt: finalTimestamp
                    });
                    await updateDoc(doc(db, 'suppliers', entity.id), {
                        debt: increment(-paid)
                    });
                }

            } else {
                // --- CLIENT (RESTAURANT) LOGIC ---
                // A. Create Order
                const globalTxData = {
                    userId: entity.id,
                    type: 'ORDER_PLACED',
                    amount: finalTotal,
                    order_total: finalTotal,
                    items: activeTab === 'grid' ? cart.map(i => ({ id: i.id, title: i.title, quantity: i.qty, price: i.price, total: i.total })) : [],
                    notes: 'طلبية موظف (بوابة المبيعات)',
                    createdAt: finalTimestamp,
                    source: 'staff_portal'
                };

                await addDoc(collection(db, 'transactions'), globalTxData);
                await updateDoc(doc(db, 'users', entity.id), {
                    currentDebt: increment(finalTotal), // Legacy
                    totalDebt: increment(finalTotal),
                    lastTransactionDate: finalTimestamp
                });

                // B. Handle Deposit/Payment (If any)
                if (paid > 0) {
                    const paymentTx = {
                        userId: entity.id,
                        type: 'PAYMENT_RECEIVED',
                        amount: paid,
                        notes: 'دفعة مستلمة عند الطلب',
                        createdAt: finalTimestamp,
                        source: 'staff_portal'
                    };
                    await addDoc(collection(db, 'transactions'), paymentTx);
                    // For users, payments reduce debt
                    await updateDoc(doc(db, 'users', entity.id), {
                        currentDebt: increment(-paid),
                        totalDebt: increment(-paid)
                    });
                }
            }

            notify.success("تم تسجيل العملية بنجاح");

            // Clear Cart on Success
            setCart([]);
            localStorage.removeItem(cartStorageKey);

            handleBack();

        } catch (error) {
            console.error(error);
            notify.error("حدث خطأ أثناء التسجيل");
        }
    };

    if (loading) return <div className="h-screen flex items-center justify-center font-bold text-slate-400">تحميل POS...</div>;

    const filteredProducts = products.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className={`min-h-screen bg-slate-50 font-sans pb-32`}>

            {/* Header */}
            <div className="bg-white px-4 py-3 sticky top-0 z-20 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={handleBack} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200 transition">
                        <ArrowRight size={20} className="text-slate-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-black text-slate-800">{entity.name || entity.fullName}</h1>
                        <p className={`text-xs font-bold ${isSupplier ? 'text-blue-500' : 'text-orange-500'}`}>
                            {isSupplier ? 'نظام المشتريات' : 'نظام المبيعات'}
                        </p>
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('grid')}
                        className={`p-2 rounded-lg transition ${activeTab === 'grid' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
                    >
                        <Grid size={20} />
                    </button>
                    <button
                        onClick={() => setActiveTab('weight')}
                        className={`p-2 rounded-lg transition ${activeTab === 'weight' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
                    >
                        <Scale size={20} />
                    </button>
                </div>
            </div>

            {/* CONTENT: GRID MODE (Hidden Logic same as before) */}
            {activeTab === 'grid' && (
                <div className="animate-in fade-in">
                    <div className="px-4 py-2 sticky top-[68px] z-10 bg-slate-50/95 backdrop-blur">
                        <div className="relative">
                            <input
                                className={`w-full bg-white rounded-2xl py-3 pr-10 pl-4 font-bold text-slate-700 outline-none shadow-sm focus:ring-2 focus:ring-${THEME}-500 transition-all border border-slate-100`}
                                placeholder="ابحث..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                            <Search className="absolute right-3 top-3 text-slate-400" size={20} />
                        </div>
                    </div>

                    <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                        {filteredProducts.map(product => {
                            const inCart = cart.find(i => i.id === product.id);
                            return (
                                <div
                                    key={product.id}
                                    onClick={() => handleProductClick(product)}
                                    className={`bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden relative active:scale-95 transition-all cursor-pointer ${inCart ? `ring-2 ring-${THEME}-500` : ''}`}
                                >
                                    <div className="aspect-square bg-slate-100 relative">
                                        <img src={product.img || "https://placehold.co/300"} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/5" />
                                        <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-xs font-black shadow-sm">
                                            {formatPrice(isSupplier ? product.costPrice : (product.restaurantPricing?.[entity.id] || product.price))}
                                        </div>
                                    </div>
                                    <div className="p-3 text-center">
                                        <h3 className="font-bold text-slate-800 text-sm line-clamp-1">{product.title}</h3>
                                        {inCart && (
                                            <div className={`mt-1 bg-${THEME}-100 text-${THEME}-700 text-[10px] font-black px-2 py-0.5 rounded-full inline-block`}>
                                                {inCart.qty} × {inCart.price}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* CONTENT: WEIGHT MODE (Hidden Logic same as before) */}
            {activeTab === 'weight' && (
                <div className="p-4 space-y-6 animate-in slide-in-from-right-4">
                    {groups.map((group, index) => {
                        const gross = group.batches.reduce((a, b) => a + b, 0);
                        const tare = (Number(group.boxCount) || 0) * (Number(group.boxTare) || 0);
                        const net = Math.max(0, gross - tare);
                        const groupTotal = net * (Number(group.pricePerKg) || 0);

                        return (
                            <div key={group.id} className="bg-white border-2 border-slate-200 rounded-[32px] p-5 shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="bg-slate-800 text-white text-xs font-bold px-3 py-1 rounded-full">مجموعة #{index + 1}</span>
                                    {index > 0 && <button onClick={() => setGroups(prev => prev.filter(g => g.id !== group.id))}><Trash2 size={18} className="text-red-400" /></button>}
                                </div>

                                <div className="mb-4">
                                    <div className="flex gap-2 mb-2">
                                        <input
                                            type="number"
                                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-lg font-bold text-center outline-none focus:border-blue-500"
                                            placeholder="الوزن..."
                                            value={group.currentBatch}
                                            onChange={e => updateGroup(group.id, 'currentBatch', e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') handleAddBatch(group.id) }}
                                        />
                                        <button onClick={() => handleAddBatch(group.id)} className="bg-blue-600 text-white px-4 rounded-xl font-bold"><Plus /></button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 p-2 min-h-[40px]">
                                        {group.batches.map((b, i) => (
                                            <span key={i} className="bg-slate-100 text-slate-700 px-2 py-1 rounded-lg text-xs font-bold border border-slate-200">{b}</span>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 mb-1 block">صناديق</label>
                                        <input type="number" value={group.boxCount} onChange={e => updateGroup(group.id, 'boxCount', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-center font-bold" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 mb-1 block">تارة</label>
                                        <input type="number" value={group.boxTare} onChange={e => updateGroup(group.id, 'boxTare', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-center font-bold" />
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">سعر الكيلو</label>
                                    <input type="number" value={group.pricePerKg} onChange={e => updateGroup(group.id, 'pricePerKg', e.target.value)} className={`w-full bg-${THEME}-50 border border-${THEME}-200 text-${THEME}-800 rounded-xl p-3 text-center text-xl font-black`} placeholder="0" />
                                </div>

                                <div className="bg-slate-900 text-white rounded-2xl p-4 flex justify-between items-center">
                                    <div>
                                        <p className="text-[10px] opacity-70">الصافي</p>
                                        <p className="font-bold">{net.toFixed(2)} Kg</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-black">{Math.round(groupTotal).toLocaleString()}</p>
                                        <p className="text-[10px] opacity-70">دج</p>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                    <button onClick={() => setGroups(prev => [...prev, { id: Date.now(), batches: [], currentBatch: '', boxCount: '', boxTare: '1.27', pricePerKg: '' }])} className="w-full py-4 border-2 border-dashed border-slate-300 rounded-2xl font-bold text-slate-400 flex items-center justify-center gap-2">
                        <Plus /> مجموعة جديدة
                    </button>
                </div>
            )}

            {/* FLOATING ACTION BAR */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-200 p-4 z-40 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-slate-500">الإجمالي</span>
                    <span className="text-3xl font-black text-slate-900">{Math.round(totalAmount).toLocaleString()}</span>
                </div>

                <div className="flex gap-2">
                    {activeTab === 'grid' && (
                        <button onClick={() => setCartOpen(true)} className="flex-1 bg-slate-100 text-slate-800 h-14 rounded-2xl font-black text-lg">
                            السلة ({cart.length})
                        </button>
                    )}
                    <button onClick={handleInitialSubmit} className={`flex-1 bg-${THEME}-600 text-white h-14 rounded-2xl font-black text-lg shadow-lg shadow-${THEME}-500/30 flex items-center justify-center gap-2`}>
                        {isSupplier ? 'استلام' : 'بيع'} <Check />
                    </button>
                </div>
            </div>

            {/* --- CHECKOUT MODAL --- */}
            {isCheckoutOpen && (
                <div className="fixed inset-0 z-[100] flex flex-col justify-end">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCheckoutOpen(false)} />
                    <div className="bg-white w-full rounded-t-[32px] shadow-2xl p-6 relative animate-slide-up">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black text-slate-800">تأكيد العملية</h3>
                            <button onClick={() => setIsCheckoutOpen(false)} className="bg-slate-100 p-2 rounded-full"><X size={20} /></button>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-2xl mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-slate-500 font-medium">قيمة الفاتورة</span>
                                <span className="text-xl font-black text-slate-900">{Math.round(totalAmount).toLocaleString()} دج</span>
                            </div>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2">تاريخ العملية</label>
                                <input
                                    type="datetime-local"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-bold text-slate-800 outline-none focus:border-blue-500"
                                    value={checkoutDate}
                                    onChange={e => setCheckoutDate(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2">
                                    {isSupplier ? 'المبلغ المدفوع للمورد (إن وجد)' : 'المبلغ المقبوض (دفعة/عربون)'}
                                </label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-bold text-slate-800 outline-none focus:border-blue-500"
                                    placeholder="0"
                                    value={checkoutPaidAmount}
                                    onChange={e => setCheckoutPaidAmount(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleFinalSubmit}
                            className={`w-full bg-${THEME}-600 text-white h-14 rounded-2xl font-black text-lg shadow-xl shadow-${THEME}-900/20 active:scale-95 transition-transform`}
                        >
                            تأكيد وحفظ
                        </button>
                    </div>
                </div>
            )}

            {/* ... Other Modals (Product) ... */}
            {selectedProduct && (
                <div className="fixed inset-0 z-[60] flex flex-col justify-end">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedProduct(null)} />
                    <div className="bg-white w-full rounded-t-[32px] shadow-2xl p-6 relative animate-slide-up">
                        <div className="flex gap-4 mb-6">
                            <img src={selectedProduct.img || "https://placehold.co/100"} className="w-20 h-20 rounded-2xl object-cover bg-slate-100" />
                            <div>
                                <h3 className="text-lg font-black text-slate-800 line-clamp-2">{selectedProduct.title}</h3>
                                <p className="text-sm font-bold text-slate-400 mt-1">{isSupplier ? 'التكلفة' : 'سعر البيع'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2">الكمية</label>
                                <input
                                    ref={qtyInputRef}
                                    type="number"
                                    className={`w-full h-16 bg-slate-50 rounded-2xl text-center text-3xl font-black text-slate-900 focus:ring-2 focus:ring-${THEME}-500 outline-none`}
                                    placeholder="0"
                                    value={inputQty}
                                    onChange={e => setInputQty(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2">السعر</label>
                                <input
                                    type="number"
                                    className="w-full h-16 bg-slate-50 rounded-2xl text-center text-3xl font-black text-slate-900 focus:ring-2 focus:ring-slate-500 outline-none"
                                    value={inputPrice}
                                    onChange={e => setInputPrice(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            onClick={addToCart}
                            className={`w-full bg-${THEME}-600 text-white h-14 rounded-2xl font-black text-lg shadow-xl shadow-${THEME}-900/20 active:scale-95 transition-transform`}
                        >
                            تأكيد
                        </button>
                    </div>
                </div>
            )}

            {cartOpen && activeTab === 'grid' && (
                <div className="fixed inset-0 z-[50] flex flex-col justify-end">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
                    <div className="bg-white w-full rounded-t-[32px] shadow-2xl p-6 relative animate-slide-up max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black text-slate-800">مراجعة الطلب</h3>
                            <button onClick={() => setCartOpen(false)} className="bg-slate-100 p-2 rounded-full"><X size={20} /></button>
                        </div>
                        <div className="space-y-3 mb-24">
                            {cart.map((item, i) => (
                                <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div>
                                        <p className="font-bold text-slate-800">{item.title}</p>
                                        <p className="text-xs font-bold text-slate-400">{item.qty} × {formatPrice(item.price)}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <p className="font-black text-lg">{formatPrice(item.total)}</p>
                                        <button onClick={() => removeFromCart(item.uniqueId)} className="text-red-400"><Trash2 size={18} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
