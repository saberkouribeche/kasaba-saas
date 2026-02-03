"use client";
import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Upload, CheckCircle, AlertCircle, Search, Plus, Trash2, ChevronDown, ChevronUp, Package, Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { CONFIG } from '@/config';
import { ThermalReceipt } from '@/components/print/ThermalReceipt';
import { db, storage } from '@/lib/firebase';
import { doc, updateDoc, increment, collection, addDoc, serverTimestamp, query, where, getDocs, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Timestamp } from 'firebase/firestore';
import { notify } from '@/lib/notify';
import { recalculateCustomerBalance } from '@/lib/balanceCalculator';
import { saveOfflineInvoice } from '@/lib/offlineSync';
import { useInvoiceSubmit } from '@/hooks/useInvoiceSubmit';

export default function AddInvoiceModal({ isOpen, onClose, client, onSuccess }) {
    const [amount, setAmount] = useState('');
    const [image, setImage] = useState(null);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [preview, setPreview] = useState(null);

    // Hook
    const { submit: submitInvoice, loading: hookLoading, error } = useInvoiceSubmit();
    const loading = hookLoading; // Alias to match existing usage

    // Detailed Mode State
    const [mode, setMode] = useState('simple'); // 'simple' | 'detailed'
    const [products, setProducts] = useState([]);
    const [items, setItems] = useState([]); // { product_id, name, quantity, price, total }
    const [searchTerm, setSearchTerm] = useState("");
    const [isProductListOpen, setIsProductListOpen] = useState(false);
    const [productsLoading, setProductsLoading] = useState(false);
    const [isSuccessState, setIsSuccessState] = useState(false);

    // Fetch Products Logic
    useEffect(() => {
        if (mode === 'detailed' && products.length === 0 && client) {
            setProductsLoading(true);
            const fetchProducts = async () => {
                try {
                    // Fetch all B2B visible products
                    const q = query(collection(db, 'product'), orderBy('title'));
                    const snapshot = await getDocs(q);

                    const availableProducts = snapshot.docs
                        .map(doc => ({ id: doc.id, ...doc.data() }))
                        .filter(p => {
                            // 1. Must be B2B visible
                            if (p.isB2bVisible !== true) return false;
                            // 2. Check restrictions
                            if (p.visibleToRestaurants && p.visibleToRestaurants.length > 0) {
                                return p.visibleToRestaurants.includes(client.phone);
                            }
                            return true;
                        });

                    setProducts(availableProducts);
                } catch (error) {
                    console.error("Error fetching products:", error);
                    notify.error("حدث خطأ في تحميل المنتجات");
                } finally {
                    setProductsLoading(false);
                }
            };
            fetchProducts();
        }
    }, [mode, client, products.length]);

    // Price Helper
    const getPrice = (product) => {
        if (!client) return product.price;
        // 1. Restaurant Specific
        if (product.restaurantPricing && product.restaurantPricing[client.phone]) {
            return Number(product.restaurantPricing[client.phone]);
        }
        // 2. Tier Price
        if (client.priceTier && product.pricingTiers?.[client.priceTier]) {
            return Number(product.pricingTiers[client.priceTier]);
        }
        return Number(product.price || 0);
    };

    // Item Management
    const handleAddItem = (product) => {
        const price = getPrice(product);
        const newItem = {
            product_id: product.id,
            name: product.title,
            category: product.category, // Save Category for Analytics
            quantity: "", // Default to empty
            price: price,
            total: 0 // Initial total 0 since quantity is empty
        };
        setItems(prev => [...prev, newItem]);
        setSearchTerm("");
        setIsProductListOpen(false);
    };

    const handleUpdateItem = (index, field, value) => {
        const newItems = [...items];
        const item = { ...newItems[index] };

        if (field === 'quantity') {
            item.quantity = value === "" ? "" : Number(value);
        }
        if (field === 'price') {
            item.price = value === "" ? "" : Number(value);
        }

        const qty = item.quantity === "" ? 0 : item.quantity;
        const prc = item.price === "" ? 0 : item.price;

        item.total = qty * prc;
        newItems[index] = item;
        setItems(newItems);
    };

    const handleRemoveItem = (index) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    // Calculate detailed total
    const detailedTotal = items.reduce((sum, item) => sum + (item.total || 0), 0);

    // Filtered Products for Search
    const filteredProducts = products.filter(p =>
        p.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isOpen || !client) return null;

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImage(file);
            setPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();


        let finalAmount = 0;
        let orderItems = [];

        if (mode === 'detailed') {
            if (items.length === 0) {
                notify.error("الرجاء إضافة منتجات للفاتورة");
                return;
            }
            finalAmount = detailedTotal;
            orderItems = items;
        } else {
            finalAmount = Number(amount);
        }

        const debtAmount = finalAmount;

        if (!debtAmount || debtAmount <= 0) {
            notify.error("الرجاء إدخال مبلغ صحيح");
            return;
        }

        if (!navigator.onLine) {
            // ... (Keep existing offline logic) ...
            const offlineData = {
                userId: client.id,
                date: date,
                amount: debtAmount,
                notes: mode === 'detailed' ? 'فاتورة تفصيلية' : 'فاتورة يدوية (وصل)',
                // Add detailed fields - MUST MATCH Hook Expectations if we sync later
                ...(mode === 'detailed' && {
                    order_items: orderItems.map(i => ({ ...i, category: i.category || 'عام' })),
                    order_total: debtAmount,
                    items_count: orderItems.length
                })
            };
            // ... (Keep existing offline save) ...
            const saved = await saveOfflineInvoice(offlineData, image);
            if (saved) {
                notify.success("تم حفظ الفاتورة في وضع عدم الاتصال.");
                onClose();
                setAmount('');
                setImage(null);
                setPreview(null);
                setItems([]);
                setSearchTerm('');
            } else {
                notify.error("فشل حفظ الفاتورة");
            }
            return;
        }

        // --- ATOMIC TRANSACTION MODE ---
        try {
            let imageUrl = null;
            if (image) {
                const storageRef = ref(storage, `invoices/${client.id}/${Date.now()}_${image.name}`);
                const snapshot = await uploadBytes(storageRef, image);
                imageUrl = await getDownloadURL(snapshot.ref);
            }

            const invoiceData = {
                userId: client.id,
                type: 'ORDER_PLACED',
                amount: debtAmount,
                notes: mode === 'detailed' ? 'فاتورة تفصيلية' : 'فاتورة يدوية (وصل)',
                imageUrl: imageUrl,
                source: 'manual_invoice',
                // Detailed Fields
                ...(mode === 'detailed' && {
                    order_items: orderItems.map(i => ({
                        id: i.product_id,
                        title: i.name,
                        name: i.name,
                        category: i.category || 'عام', // Fallback
                        quantity: i.quantity,
                        price: i.price,
                        total_price: i.total
                    })),
                    order_total: debtAmount,
                    items_count: orderItems.length
                })
            };

            // Use Hook
            // Make sure to define the hook at component level first!
            await submitInvoice(invoiceData, client, 0); // 0 = Paid Amount (Immediate)

            // Prepare for Print (add ID/Date locally for preview)
            setLastTransaction({
                ...invoiceData,
                formattedDate: new Date().toISOString(),
                userName: client.fullName
            });

            notify.success(`تم إضافة الفاتورة بقيمة ${debtAmount} دج`);

            // Auto-trigger print? Or just show button?
            // Let's show a Success State with Print Button instead of closing immediately?
            // Or just allow printing from the success toast?
            // "onSuccess" triggers refresh, "onClose" closes modal.
            // If we close modal, we lose the state.
            // Let's DELAY closing if user wants to print, OR utilize the 'onSuccess' to maybe open a 'PrintLastModal'?
            // Simplest: Don't close immediately? Or add a "Print Previous" button?

            // User UX preference usually: Submit -> print auto -> close.
            // For now, I will modify the flow: 
            // 1. Submit
            // 2. Show "Success + Print Button" overlay?
            // 3. Close.

            // Actually, keep it simple: Add a hidden receipt, trigger print, THEN close?
            // Browser might block popup.
            // Let's try: setLastTransaction -> setTimeout -> handlePrint -> onClose.

            // Better: Add "Print" button to the FORM footer if a transaction was just made?
            // But we usually reset the form.

            // Let's just NOT close, and show a "Success! Print?" dialog inside the modal.
            // But the requirements say "Add Print Button to AddInvoiceModal (success state)".
            // So I need a "Success State".

            setIsSuccessState(true); // New State needed
            onSuccess?.(); // Refresh background data

            // Reset fields but keep lastTransaction
            setAmount('');
            setImage(null);
            setItems([]);
            // onClose(); // -- Don't close yet
            setSearchTerm('');
            setDate(new Date().toISOString().split('T')[0]);

        } catch (error) {
            console.error(error);
            // Error is handled by hook (thrown), we just show toast if specific
            // Hook throws readable errors for stock
            notify.error(error.message || "فشل حفظ الفاتورة");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className={`bg-white rounded-3xl w-full ${mode === 'detailed' ? 'max-w-3xl' : 'max-w-md'} shadow-2xl relative transition-all duration-300 flex flex-col max-h-[90vh] overflow-hidden`}>
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-50 transition"
                >
                    <X size={24} />
                </button>

                <div className="flex-shrink-0 p-6 pb-0">
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-black text-slate-800">إضافة فاتورة جديدة</h2>
                        <p className="text-sm text-slate-500 font-bold mt-1">{client.fullName}</p>
                    </div>

                    {isSuccessState ? (
                        <div className="flex flex-col items-center justify-center space-y-4 py-10 animate-in zoom-in-50">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-2">
                                <CheckCircle size={40} />
                            </div>
                            <h3 className="text-xl font-black text-slate-800">تم حفظ الفاتورة بنجاح</h3>
                            <div className="flex gap-3 mt-4 w-full">
                                <button
                                    onClick={() => handlePrint()}
                                    className="flex-1 bg-slate-800 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-700 transition"
                                >
                                    <Printer size={20} />
                                    طباعة الوصل
                                </button>
                                <button
                                    onClick={() => {
                                        setIsSuccessState(false);
                                        onClose();
                                    }}
                                    className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition"
                                >
                                    إغلاق
                                </button>
                            </div>
                            <button
                                onClick={() => setIsSuccessState(false)}
                                className="text-blue-600 font-bold text-sm mt-4 hover:underline"
                            >
                                إضافة فاتورة أخرى
                            </button>

                            {/* Hidden Receipt */}
                            <div style={{ display: 'none' }}>
                                <ThermalReceipt ref={printRef} transaction={lastTransaction} />
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-center mb-6">
                                <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setMode('simple')}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition ${mode === 'simple' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        مبلغ إجمالي
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setMode('detailed')}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition ${mode === 'detailed' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        فاتورة مفصلة
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {!isSuccessState && (
                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                        <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar space-y-6">
                            {/* Simple Amount Input */}
                            {mode === 'simple' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">إجمالي الفاتورة (دج)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className="w-full text-2xl font-black text-center bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition"
                                            placeholder="0"
                                            required={mode === 'simple'}
                                        />
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">دج</div>
                                    </div>
                                </div>
                            )}

                            {/* Detailed Input */}
                            {mode === 'detailed' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
                                    {/* Product Search */}
                                    <div className="relative">
                                        <label className="block text-sm font-bold text-slate-700 mb-2">إضافة منتجات</label>
                                        <div className="relative">
                                            <Search className="absolute right-3 top-3 text-slate-400" size={18} />
                                            <input
                                                type="text"
                                                placeholder="ابحث عن منتج..."
                                                value={searchTerm}
                                                onChange={(e) => {
                                                    setSearchTerm(e.target.value);
                                                    setIsProductListOpen(true);
                                                }}
                                                onFocus={() => setIsProductListOpen(true)}
                                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 pr-10 pl-4 focus:border-blue-500 outline-none font-bold"
                                            />
                                        </div>

                                        {/* Dropdown Results */}
                                        {isProductListOpen && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 max-h-60 overflow-y-auto z-20">
                                                {productsLoading ? (
                                                    <div className="p-4 text-center text-slate-400">جاري التحميل...</div>
                                                ) : filteredProducts.length === 0 ? (
                                                    <div className="p-4 text-center text-slate-400">لا توجد منتجات مطابقة</div>
                                                ) : (
                                                    filteredProducts.map(product => (
                                                        <button
                                                            key={product.id}
                                                            type="button"
                                                            onClick={() => handleAddItem(product)}
                                                            className="w-full p-3 text-right hover:bg-slate-50 border-b border-slate-50 last:border-0 flex justify-between items-center group"
                                                        >
                                                            <span className="font-bold text-slate-800">{product.title}</span>
                                                            <span className="text-sm font-bold text-slate-400 group-hover:text-blue-600">
                                                                {getPrice(product).toLocaleString()} دج
                                                                {CONFIG.ENABLE_INVENTORY_MANAGEMENT !== false && (
                                                                    <span className={`mr-2 text-xs ${product.stock <= 0 ? 'text-red-500' : 'text-slate-300'}`}>
                                                                        ({product.stock})
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Items Table */}
                                    <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                                        {/* Header */}
                                        <div className="grid grid-cols-12 gap-2 p-3 bg-slate-100 text-xs font-bold text-slate-500">
                                            <div className="col-span-4">المنتج</div>
                                            <div className="col-span-2 text-center">الكمية</div>
                                            <div className="col-span-3 text-center">السعر</div>
                                            <div className="col-span-2 text-center">الإجمالي</div>
                                            <div className="col-span-1"></div>
                                        </div>

                                        {/* Rows */}
                                        <div className="max-h-60 overflow-y-auto">
                                            {items.length === 0 ? (
                                                <div className="p-8 text-center text-slate-400 flex flex-col items-center">
                                                    <Package className="mb-2 opacity-50" size={24} />
                                                    <span className="text-xs font-bold">لم تتم إضافة منتجات بعد</span>
                                                </div>
                                            ) : (
                                                items.map((item, idx) => (
                                                    <div key={idx} className="grid grid-cols-12 gap-2 p-2 border-b border-slate-100 items-center hover:bg-white transition relative group">
                                                        <div className="col-span-4 font-bold text-slate-800 text-sm truncate pr-2">{item.name}</div>
                                                        <div className="col-span-2">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="any"
                                                                value={item.quantity}
                                                                onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                                                                className="w-full text-center bg-white border border-slate-200 rounded-lg py-1 text-sm font-bold focus:border-blue-500 outline-none"
                                                            />
                                                        </div>
                                                        <div className="col-span-3">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="any"
                                                                value={item.price}
                                                                onChange={(e) => handleUpdateItem(idx, 'price', e.target.value)}
                                                                className="w-full text-center bg-white border border-slate-200 rounded-lg py-1 text-sm font-bold focus:border-blue-500 outline-none"
                                                            />
                                                        </div>
                                                        <div className="col-span-2 text-center font-black text-slate-700 text-sm">
                                                            {item.total.toLocaleString()}
                                                        </div>
                                                        <div className="col-span-1 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveItem(idx)}
                                                                className="text-slate-300 hover:text-red-500 p-1 rounded-md hover:bg-red-50 transition"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {/* Total */}
                                        <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                                            <span className="font-bold text-sm">الإجمالي النهائي</span>
                                            <span className="font-black text-xl">{detailedTotal.toLocaleString()} <span className="text-xs font-medium text-slate-400">دج</span></span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Date Input */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">تاريخ الفاتورة</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full text-lg font-bold bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 px-4 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition text-slate-800"
                                    required
                                />
                            </div>


                            {/* Image Upload */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">صورة الوصل (اختياري)</label>
                                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:bg-slate-50 transition cursor-pointer relative overflow-hidden group">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    />
                                    {preview ? (
                                        <div className="relative h-40 w-full flex items-center justify-center bg-slate-900 rounded-xl overflow-hidden">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={preview} alt="Preview" className="h-full object-contain" />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                                <p className="text-white font-bold text-sm flex items-center gap-2"><Upload size={16} /> تغيير الصورة</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-8 text-slate-400">
                                            <Upload className="mx-auto mb-2" size={32} />
                                            <p className="text-xs font-bold">اضغط لرفع صورة أو اسحبها هنا</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                        <div className="flex-shrink-0 p-6 pt-0">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black text-lg shadow-lg shadow-blue-200 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? "جاري الحفظ..." : "حفظ الفاتورة"}
                            </button>
                        </div>
                    </form>
                )}
            </div >
        </div >
    );
}
