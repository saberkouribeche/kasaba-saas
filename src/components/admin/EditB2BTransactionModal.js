"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { X, Save, Upload, Calendar, Clock, DollarSign, FileText, Search, Trash2, Package } from "lucide-react";
import { db, storage } from "@/lib/firebase";
import { doc, updateDoc, Timestamp, collection, query, orderBy, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { notify } from "@/lib/notify";
import { recalculateCustomerBalance } from "@/lib/balanceCalculator";

export default function EditTransactionModal({ isOpen, onClose, transaction, client, onSuccess }) {
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [image, setImage] = useState(null);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);

    // Detailed Mode State
    const [mode, setMode] = useState('simple'); // 'simple' | 'detailed'
    const [products, setProducts] = useState([]);
    const [items, setItems] = useState([]); // { product_id, name, quantity, price, total }
    const [searchTerm, setSearchTerm] = useState("");
    const [isProductListOpen, setIsProductListOpen] = useState(false);
    const [productsLoading, setProductsLoading] = useState(false);

    // Initialize State
    useEffect(() => {
        if (transaction) {
            setAmount(transaction.amount || 0);
            setNotes(transaction.notes || "");
            setPreview(null);
            setImage(null);

            // Handle Date
            const txDate = transaction.createdAt?.toDate ? transaction.createdAt.toDate() :
                (transaction.created_at?.toDate ? transaction.created_at.toDate() : new Date());

            const yyyy = txDate.getFullYear();
            const mm = String(txDate.getMonth() + 1).padStart(2, '0');
            const dd = String(txDate.getDate()).padStart(2, '0');
            setDate(`${yyyy}-${mm}-${dd}`);

            const hh = String(txDate.getHours()).padStart(2, '0');
            const min = String(txDate.getMinutes()).padStart(2, '0');
            setTime(`${hh}:${min}`);

            // Initialize Items for Detailed Mode
            if (transaction.order_items && transaction.order_items.length > 0) {
                setMode('detailed');
                setItems(transaction.order_items.map(i => ({
                    product_id: i.id || i.product_id,
                    name: i.title || i.name,
                    quantity: i.quantity,
                    price: i.price,
                    total: i.total_price || (i.quantity * i.price)
                })));
            } else {
                setMode('simple');
                setItems([]);
            }
        }
    }, [transaction, isOpen]);

    // Fetch Products Logic (Only if Detailed and client exists)
    useEffect(() => {
        if (mode === 'detailed' && products.length === 0 && client) {
            setProductsLoading(true);
            const fetchProducts = async () => {
                try {
                    const q = query(collection(db, 'product'), orderBy('title'));
                    const snapshot = await getDocs(q);

                    const availableProducts = snapshot.docs
                        .map(doc => ({ id: doc.id, ...doc.data() }))
                        .filter(p => {
                            if (p.isB2bVisible !== true) return false;
                            if (p.visibleToRestaurants && p.visibleToRestaurants.length > 0) {
                                return p.visibleToRestaurants.includes(client.phone);
                            }
                            return true;
                        });
                    setProducts(availableProducts);
                } catch (error) {
                    console.error("Error fetching products:", error);
                } finally {
                    setProductsLoading(false);
                }
            };
            fetchProducts();
        }
    }, [mode, client, products.length]);

    // Helpers
    const getPrice = (product) => {
        if (!client) return product.price;
        if (product.restaurantPricing && product.restaurantPricing[client.phone]) {
            return Number(product.restaurantPricing[client.phone]);
        }
        if (client.priceTier && product.pricingTiers?.[client.priceTier]) {
            return Number(product.pricingTiers[client.priceTier]);
        }
        return Number(product.price || 0);
    };

    const handleAddItem = (product) => {
        const price = getPrice(product);
        const newItem = {
            product_id: product.id,
            name: product.title,
            quantity: 1,
            price: price,
            total: price
        };
        setItems(prev => [...prev, newItem]);
        setSearchTerm("");
        setIsProductListOpen(false);
    };

    const handleUpdateItem = (index, field, value) => {
        const newItems = [...items];
        const item = { ...newItems[index] };

        if (field === 'quantity') item.quantity = Number(value);
        if (field === 'price') item.price = Number(value);

        item.total = item.quantity * item.price;
        newItems[index] = item;
        setItems(newItems);
    };

    const handleRemoveItem = (index) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const detailedTotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
    const filteredProducts = products.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!isOpen || !transaction) return null;

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImage(file);
            setPreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const [year, month, day] = date.split('-').map(Number);
            const [hours, minutes] = time.split(':').map(Number);
            const newDate = new Date(year, month - 1, day, hours, minutes);
            const newTimestamp = Timestamp.fromDate(newDate);

            // Upload Image if Changed
            let imageUrl = transaction.imageUrl;
            if (image) {
                const storageRef = ref(storage, `invoices/${transaction.userId}/${Date.now()}_${image.name}`);
                const snapshot = await uploadBytes(storageRef, image);
                imageUrl = await getDownloadURL(snapshot.ref);
            }

            const updateData = {
                notes: notes.trim(),
                createdAt: newTimestamp,
                imageUrl: imageUrl || null
            };

            if (mode === 'detailed') {
                if (items.length === 0) {
                    notify.error("الرجاء إضافة منتجات");
                    setLoading(false);
                    return;
                }
                updateData.order_items = items.map(i => ({
                    id: i.product_id,
                    title: i.name,
                    name: i.name,
                    quantity: i.quantity,
                    price: i.price,
                    total_price: i.total
                }));
                updateData.amount = detailedTotal;
                updateData.order_total = detailedTotal;
                updateData.items_count = items.length;
            } else {
                updateData.amount = Number(amount);
            }

            const txRef = doc(db, "transactions", transaction.id);
            await updateDoc(txRef, updateData);

            await recalculateCustomerBalance(transaction.userId);

            notify.success("تم تحديث المعاملة بنجاح");
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Error updating transaction:", error);
            notify.error("فشل تحديث المعاملة");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className={`bg-white rounded-3xl w-full ${mode === 'detailed' ? 'max-w-3xl' : 'max-w-lg'} shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all duration-300`}>
                {/* Header */}
                <div className="bg-slate-900 px-6 py-5 flex justify-between items-center text-white shrink-0">
                    <div>
                        <h3 className="text-xl font-black">{mode === 'detailed' ? 'تعديل الفاتورة (مفصل)' : 'تعديل المعاملة'}</h3>
                        <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">#{transaction.id.slice(0, 8)}</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* Mode Switcher if creating fresh or if simple */}
                {(mode === 'simple' && (!transaction.order_items || transaction.order_items.length === 0)) && (
                    <div className="flex justify-center p-4 pb-0 bg-slate-50">
                        <div className="bg-slate-200 p-1 rounded-xl flex gap-1">
                            <button onClick={() => setMode('simple')} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${mode === 'simple' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>مبلغ إجمالي</button>
                            <button onClick={() => setMode('detailed')} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${mode === 'detailed' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>فاتورة مفصلة</button>
                        </div>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar dir-rtl">

                    {/* Simple Amount Input */}
                    {mode === 'simple' && (
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1"><DollarSign size={14} className="text-green-600" /> المبلغ (دج)</label>
                            <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full text-2xl font-black text-center bg-slate-50 border-2 border-slate-100 rounded-2xl py-3 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none" />
                        </div>
                    )}

                    {/* Detailed Items Input */}
                    {mode === 'detailed' && (
                        <div className="space-y-4">
                            {/* Search */}
                            <div className="relative">
                                <label className="block text-sm font-bold text-slate-700 mb-2">إضافة منتجات</label>
                                <div className="relative">
                                    <Search className="absolute right-3 top-3 text-slate-400" size={18} />
                                    <input type="text" placeholder="ابحث عن منتج..." value={searchTerm}
                                        onChange={(e) => { setSearchTerm(e.target.value); setIsProductListOpen(true); }}
                                        onFocus={() => setIsProductListOpen(true)}
                                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-3 pr-10 pl-4 focus:border-blue-500 outline-none font-bold"
                                    />
                                </div>
                                {isProductListOpen && filteredProducts.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 max-h-60 overflow-y-auto z-20">
                                        {filteredProducts.map(p => (
                                            <button key={p.id} type="button" onClick={() => handleAddItem(p)} className="w-full p-3 text-right hover:bg-slate-50 border-b border-slate-50 flex justify-between items-center bg-white z-50 relative">
                                                <span className="font-bold text-slate-800">{p.title}</span>
                                                <span className="text-sm font-bold text-slate-400">{getPrice(p).toLocaleString()} دج</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Table */}
                            <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                                <div className="grid grid-cols-12 gap-2 p-3 bg-slate-100 text-xs font-bold text-slate-500 text-right">
                                    <div className="col-span-4">المنتج</div>
                                    <div className="col-span-2 text-center">الكمية</div>
                                    <div className="col-span-3 text-center">السعر</div>
                                    <div className="col-span-2 text-center">الإجمالي</div>
                                    <div className="col-span-1"></div>
                                </div>
                                <div className="max-h-60 overflow-y-auto">
                                    {items.length === 0 ? (
                                        <div className="p-8 text-center text-slate-400 flex flex-col items-center"><Package className="mb-2 opacity-50" size={24} /><span className="text-xs font-bold">لم تتم إضافة منتجات</span></div>
                                    ) : (
                                        items.map((item, idx) => (
                                            <div key={idx} className="grid grid-cols-12 gap-2 p-2 border-b border-slate-100 items-center hover:bg-white transition">
                                                <div className="col-span-4 font-bold text-slate-800 text-sm truncate pr-2">{item.name}</div>
                                                <div className="col-span-2"><input type="number" min="0" step="any" value={item.quantity} onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)} className="w-full text-center bg-white border border-slate-200 rounded-lg py-1 text-sm font-bold focus:border-blue-500 outline-none" /></div>
                                                <div className="col-span-3"><input type="number" min="0" step="any" value={item.price} onChange={(e) => handleUpdateItem(idx, 'price', e.target.value)} className="w-full text-center bg-white border border-slate-200 rounded-lg py-1 text-sm font-bold focus:border-blue-500 outline-none" /></div>
                                                <div className="col-span-2 text-center font-black text-slate-700 text-sm">{item.total.toLocaleString()}</div>
                                                <div className="col-span-1 text-center"><button type="button" onClick={() => handleRemoveItem(idx)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={16} /></button></div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                                    <span className="font-bold text-sm">الإجمالي النهائي</span>
                                    <span className="font-black text-xl">{detailedTotal.toLocaleString()} <span className="text-xs font-medium text-slate-400">دج</span></span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Common Fields */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1"><Calendar size={14} /> التاريخ</label>
                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 bg-white focus:border-blue-500 outline-none font-bold text-sm" required />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1"><Clock size={14} /> الوقت</label>
                            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 bg-white focus:border-blue-500 outline-none font-bold text-sm" required />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1"><FileText size={14} /> ملاحظات</label>
                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full p-3 rounded-xl border border-gray-200 bg-slate-50 focus:border-blue-500 outline-none font-bold text-sm resize-none" placeholder="أضف ملاحظات..." />
                    </div>

                    {/* Image Upload - simplified for updating */}
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center">
                        <label className="text-xs font-bold text-slate-500 mb-2 block">تحديث الصورة (اختياري)</label>
                        <input type="file" accept="image/*" onChange={handleImageChange} className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                        {(preview || transaction.imageUrl) && (
                            <div className="mt-4 h-32 relative mx-auto w-32">
                                <img src={preview || transaction.imageUrl} className="w-full h-full object-cover rounded-lg" alt="preview" />
                            </div>
                        )}
                    </div>

                    <button type="submit" disabled={loading} className="w-full py-4 rounded-2xl font-black text-white bg-slate-900 hover:bg-black transition shadow-xl shadow-slate-900/20 disabled:opacity-50 flex items-center justify-center gap-2 text-lg active:scale-[0.98]">
                        {loading ? "جاري الحفظ..." : <><Save size={20} /> حفظ التعديلات</>}
                    </button>
                </form>
            </div>
        </div>
    );
}
