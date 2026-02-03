"use client";
import { useState, useEffect, useRef, use } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, updateDoc, doc, increment, serverTimestamp, query, where, collectionGroup, writeBatch } from "firebase/firestore";
import { notify } from "@/lib/notify";
import { Search, ShoppingCart, Trash2, Check, ArrowLeft, Store, Save, ChevronUp, ChevronDown } from "lucide-react";
import { formatPrice } from "@/lib/formatters";
import { useRouter } from "next/navigation";

export default function EditTransactionPage({ params }) {
    // Unwrap params for Next.js 15+
    const unwrappedParams = use(params);
    const transactionId = unwrappedParams.id;
    const router = useRouter();

    // --- State ---
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    // Data
    const [transaction, setTransaction] = useState(null);
    const [supplier, setSupplier] = useState(null);
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]); // { productId, productName, qty, cost, total }

    // Interaction
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [inputQty, setInputQty] = useState("");
    const [inputCost, setInputCost] = useState("");
    const [cartOpen, setCartOpen] = useState(false);
    const qtyInputRef = useRef(null);

    // --- Hydration ---
    useEffect(() => {
        const fetchTransaction = async () => {
            try {
                // 1. Find Transaction (Collection Group)
                const txQuery = query(collectionGroup(db, 'transactions'), where('__name__', '==', transactionId));
                const txSnap = await getDocs(txQuery);

                if (txSnap.empty) {
                    notify.error("العملية غير موجودة");
                    setLoading(false);
                    return;
                }

                const docSnap = txSnap.docs[0];
                const data = docSnap.data();

                // Get Supplier ID from path: suppliers/{supplierId}/transactions/{txId}
                const supplierId = docSnap.ref.parent.parent.id;

                setTransaction({ id: docSnap.id, ref: docSnap.ref, ...data, supplierId });

                // 2. Fetch Supplier
                const supSnap = await getDocs(query(collection(db, 'suppliers'), where('__name__', '==', supplierId)));
                if (!supSnap.empty) {
                    setSupplier({ id: supSnap.docs[0].id, ...supSnap.docs[0].data() });
                }

                // 3. Hydrate Cart from Items
                // Data mapping: items array stored in details or direct items field
                // Based on previous code: items: [{ productId, productName, qty, cost, total }]
                const storedItems = data.items || data.details?.items || [];

                const initialCart = storedItems.map(item => ({
                    productId: item.productId || item.id,
                    productName: item.productName || item.title,
                    qty: Number(item.qty || item.quantity),
                    cost: Number(item.cost || item.price),
                    total: (Number(item.qty || item.quantity) * Number(item.cost || item.price))
                }));
                setCart(initialCart);

                // 4. Fetch Products (Filtered by Supplier)
                const prodRef = collection(db, 'product');
                const prodSnap = await getDocs(prodRef);
                const allProducts = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                // Filter logic: show products linked to supplier OR globally available?
                // Visual POS usually shows all products or filtered. Let's filter by Supplier ID if present in product
                const supplierProducts = allProducts.filter(p => p.supplierId === supplierId);
                setProducts(supplierProducts.length > 0 ? supplierProducts : allProducts); // Fallback to all if none linked

                setLoading(false);
            } catch (err) {
                console.error("Hydration Error:", err);
                notify.error("فشل تحميل البيانات");
                setLoading(false);
            }
        };

        if (transactionId) fetchTransaction();
    }, [transactionId]);

    // --- Focus Input ---
    useEffect(() => {
        if (selectedProduct && qtyInputRef.current) {
            setTimeout(() => qtyInputRef.current.focus(), 150);
        }
    }, [selectedProduct]);

    // --- Calculation ---
    const cartTotal = cart.reduce((sum, item) => sum + item.total, 0);

    const filteredProducts = products.filter(p =>
        p.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // --- Actions ---
    const handleProductClick = (product) => {
        const existing = cart.find(i => i.productId === product.id);
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

        const cost = Number(inputCost) || 0;
        const qty = Number(inputQty);
        const newItem = {
            productId: selectedProduct.id,
            productName: selectedProduct.title,
            qty: qty,
            cost: cost,
            total: qty * cost
        };

        setCart(prev => {
            const idx = prev.findIndex(i => i.productId === newItem.productId);
            if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = newItem;
                return updated;
            }
            return [...prev, newItem];
        });

        notify.success("تم التحديث");
        handleSheetClose();
    };

    const removeFromCart = (id) => {
        setCart(prev => prev.filter(i => i.productId !== id));
    };

    // --- ATOMIC UPDATE LOGIC ---
    const handleUpdate = async () => {
        if (!transaction) return;
        setProcessing(true);

        try {
            const oldTotal = transaction.amount || 0;
            const newTotal = cartTotal;
            const debtAdjustment = newTotal - oldTotal;

            const batch = writeBatch(db);

            // 1. Update Transaction
            batch.update(transaction.ref, {
                amount: newTotal,
                items: cart, // Save cart structure
                // details: { items: cart }, // Legacy compat if needed? Let's stick to standard 'items'
                updatedAt: serverTimestamp()
            });

            // 2. Update Supplier Debt (Atomic Increment)
            if (debtAdjustment !== 0) {
                const supplierRef = doc(db, 'suppliers', transaction.supplierId);
                batch.update(supplierRef, {
                    debt: increment(debtAdjustment)
                });
            }

            await batch.commit();

            notify.success(`تم تحديث الفاتورة (الفرق: ${debtAdjustment > 0 ? '+' : ''}${debtAdjustment.toLocaleString()})`);
            router.back();

        } catch (error) {
            console.error("Update Error:", error);
            notify.error("حدث خطأ أثناء الحفظ");
        } finally {
            setProcessing(false);
        }
    };


    if (loading) return <div className="h-screen flex items-center justify-center font-bold text-slate-400">جاري التحميل...</div>;

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-32">

            {/* Header (Sticky) */}
            <div className="bg-white px-4 py-3 sticky top-0 z-20 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200 transition">
                        <ArrowLeft size={20} className="text-slate-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-black text-slate-800">تعديل الفاتورة ✏️</h1>
                        <p className="text-xs font-bold text-slate-400">{supplier?.name}</p>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="px-4 py-3 sticky top-[64px] z-10 bg-slate-50/95 backdrop-blur">
                <div className="relative">
                    <Search className="absolute right-3 top-3 text-slate-400" size={20} />
                    <input
                        className="w-full bg-white rounded-2xl py-3 pr-10 pl-4 font-bold text-slate-700 outline-none shadow-sm focus:ring-2 focus:ring-blue-500 transition-all border border-slate-100"
                        placeholder="ابحث عن منتج..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Product Grid */}
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                {filteredProducts.map(product => {
                    const inCart = cart.find(i => i.productId === product.id);
                    return (
                        <div
                            key={product.id}
                            onClick={() => handleProductClick(product)}
                            className={`relative group overflow-hidden bg-white rounded-[24px] shadow-sm border border-gray-100 active:scale-95 transition-all duration-200 cursor-pointer ${inCart ? 'ring-2 ring-orange-400' : ''}`}
                        >
                            <div className="aspect-square bg-slate-100 relative">
                                <img src={product.img || "https://placehold.co/300"} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/10" />
                                <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-xs font-black shadow-sm">
                                    {formatPrice(product.costPrice || 0)}
                                </div>
                            </div>
                            <div className="p-3 text-center">
                                <h3 className="font-bold text-slate-800 text-sm line-clamp-1">{product.title}</h3>
                                {inCart && (
                                    <div className="mt-1 bg-orange-100 text-orange-700 text-[10px] font-black px-2 py-0.5 rounded-full inline-flex items-center gap-1 animate-pulse">
                                        <Check size={10} /> {inCart.qty}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Bottom Bar (Floating) */}
            <div className={`fixed bottom-0 left-0 right-0 z-30 transition-transform duration-300 ${cartOpen ? 'translate-y-full' : 'translate-y-0'}`}>
                <div className="bg-white/90 backdrop-blur-md border-t border-gray-200 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] p-4">
                    <div
                        onClick={() => setCartOpen(true)}
                        className="flex items-center justify-between mb-3 cursor-pointer active:opacity-70"
                    >
                        <div className="flex items-center gap-2">
                            <div className="bg-orange-100 text-orange-600 p-2 rounded-xl">
                                <ChevronUp size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500">التعديلات ({cart.length})</p>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-2xl font-black text-slate-900">{cartTotal.toLocaleString()}</p>
                                    <p className="text-xs font-bold text-slate-300 line-through decoration-red-400 decoration-2">
                                        {formatPrice(transaction?.amount || 0)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleUpdate}
                        disabled={processing}
                        className="w-full bg-slate-900 text-white h-14 rounded-2xl font-black text-lg shadow-lg shadow-slate-900/20 flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                        {processing ? 'جاري الحفظ...' : <span>حفظ التعديلات <Save size={20} className="inline" /></span>}
                    </button>
                </div>
            </div>

            {/* Cart Drawer */}
            {cartOpen && (
                <div className="fixed inset-0 z-[40] flex flex-col justify-end">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
                    <div className="bg-white w-full rounded-t-[32px] shadow-2xl p-6 relative animate-slide-up max-h-[80vh] flex flex-col">
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />

                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black text-slate-800">مراجعة التعديلات</h3>
                            <button onClick={() => setCartOpen(false)} className="bg-slate-50 p-2 rounded-full"><ChevronDown /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 mb-6">
                            {cart.map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{item.productName}</p>
                                        <p className="text-xs font-bold text-slate-400 mt-1">
                                            {item.qty} × {formatPrice(item.cost)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <p className="font-black text-slate-800 dir-ltr">{formatPrice(item.total)}</p>
                                        <button onClick={() => removeFromCart(item.productId)} className="text-red-400 hover:text-red-600 bg-white p-2 rounded-xl shadow-sm"><Trash2 size={18} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Input Sheet */}
            {selectedProduct && (
                <div className="fixed inset-0 z-[50] flex flex-col justify-end">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleSheetClose} />
                    <div className="bg-white w-full rounded-t-[32px] shadow-2xl p-6 relative animate-slide-up">
                        <div className="flex gap-4 mb-6">
                            <img src={selectedProduct.img || "https://placehold.co/100"} className="w-20 h-20 rounded-2xl object-cover bg-slate-100" />
                            <div>
                                <h3 className="text-lg font-black text-slate-800 line-clamp-2">{selectedProduct.title}</h3>
                                <p className="text-sm font-bold text-slate-400 mt-1">تكلفة سابقة: {selectedProduct.costPrice || 0}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2">الكمية المقبوضة</label>
                                <input
                                    ref={qtyInputRef}
                                    type="number"
                                    className="w-full h-16 bg-slate-50 rounded-2xl text-center text-3xl font-black text-slate-900 focus:ring-2 focus:ring-orange-500 outline-none"
                                    placeholder="0"
                                    value={inputQty}
                                    onChange={e => setInputQty(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2">سعر التكلفة (للوحدة)</label>
                                <input
                                    type="number"
                                    className="w-full h-16 bg-slate-50 rounded-2xl text-center text-3xl font-black text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={inputCost}
                                    onChange={e => setInputCost(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            onClick={addToCart}
                            className="w-full bg-slate-900 text-white h-14 rounded-2xl font-black text-lg shadow-xl shadow-slate-900/20 active:scale-95 transition-transform"
                        >
                            تحديث البند
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}
